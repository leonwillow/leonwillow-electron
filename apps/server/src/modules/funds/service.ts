/**
 * @file 流水案件权限、导入版本、核对与图分析服务。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：首版完整案件闭环；保留原文及历次规范快照。
 * 被调用：funds API、整案导入脚本；调用：PG、解析/归并和 Neo4j 适配。
 * 功能：案件归属隔离、文件幂等导入、串行版本提交、图同步失败恢复。
 * 预期结果：PG 持久化后才投影图；不同步的版本禁止继续分析。
 */
import type { Database, DatabaseTransaction } from "@leonwillow-electron/db";
import {
	type FundsFileRef,
	fundsCase,
	fundsJob,
	fundsRevision,
	fundsSource,
	fundsTransaction,
} from "@leonwillow-electron/db/schema";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import { prepareCanonical } from "./canonical";
import { csvDocument, standardHeaders, standardRows } from "./export";
import { originalResponse, readStoredFile, saveOriginal } from "./file-store";
import { parseStatement } from "./parser";
import { reconcile } from "./reconcile";
import type {
	FundsSnapshot,
	GraphFilter,
	MatchDecision,
	ParsedSource,
} from "./types";

export type Actor = Pick<AccessSession, "user">;
function checkOwner(
	actor: Actor,
	record: typeof fundsCase.$inferSelect | undefined,
) {
	if (
		!record ||
		record.deletedAt ||
		(actor.user.role !== "admin" && record.ownerId !== actor.user.id)
	)
		throw new AccessError(
			404,
			"CASE_NOT_FOUND",
			"案件不存在或你没有访问权限。",
		);
	return record;
}
export async function findCase(actor: Actor, id: string) {
	const { db } = getServerResources();
	const [record] = await db
		.select()
		.from(fundsCase)
		.where(eq(fundsCase.id, id));
	return checkOwner(actor, record);
}
export async function latest(caseId: string, revision: number) {
	const { db } = getServerResources();
	const [row] = await db
		.select()
		.from(fundsRevision)
		.where(
			and(
				eq(fundsRevision.caseId, caseId),
				eq(fundsRevision.revision, revision),
			),
		);
	return row
		? {
				snapshot: row.snapshot as FundsSnapshot,
				decisions: row.decisions as MatchDecision[],
			}
		: { snapshot: reconcile([]), decisions: [] };
}
export async function sourcesFor(
	caseId: string,
	tx: Database | DatabaseTransaction = getServerResources().db,
) {
	const rows = await tx
		.select({ parsed: fundsSource.parsed })
		.from(fundsSource)
		.where(and(eq(fundsSource.caseId, caseId), eq(fundsSource.active, true)));
	return rows.map((row) => row.parsed as ParsedSource);
}
export async function lockCase(
	tx: DatabaseTransaction,
	actor: Actor,
	caseId: string,
) {
	const [record] = await tx
		.select()
		.from(fundsCase)
		.where(eq(fundsCase.id, caseId))
		.for("update");
	return checkOwner(actor, record);
}
export async function saveRevision(
	tx: DatabaseTransaction,
	actor: Actor,
	caseId: string,
	revision: number,
	action: string,
	snapshot: FundsSnapshot,
	decisions: MatchDecision[],
	enqueueProjection = true,
) {
	const [previous] = await tx
		.select()
		.from(fundsRevision)
		.where(
			and(
				eq(fundsRevision.caseId, caseId),
				eq(fundsRevision.revision, revision - 1),
			),
		);
	prepareCanonical(
		snapshot,
		previous?.snapshot as FundsSnapshot | undefined,
		await sourcesFor(caseId, tx),
	);
	await tx.insert(fundsRevision).values({
		caseId,
		revision,
		action,
		actorId: actor.user.id,
		snapshot,
		decisions,
	});
	await tx.update(fundsCase).set({ revision }).where(eq(fundsCase.id, caseId));
	await tx
		.update(fundsTransaction)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(fundsTransaction.caseId, caseId),
				isNull(fundsTransaction.deletedAt),
			),
		);
	const held = new Set(snapshot.heldTransactionIds ?? []);
	const accepted = snapshot.transactions.filter((t) => !held.has(t.id));
	for (let i = 0; i < accepted.length; i += 1000)
		await tx
			.insert(fundsTransaction)
			.values(
				accepted.slice(i, i + 1000).map((t) => ({
					caseId,
					id: t.id,
					revision,
					fromAccount: t.from,
					toAccount: t.to,
					data: t,
					deletedAt: null,
				})),
			)
			.onConflictDoUpdate({
				target: [fundsTransaction.caseId, fundsTransaction.id],
				set: {
					revision,
					fromAccount: sql`excluded.from_account`,
					toAccount: sql`excluded.to_account`,
					data: sql`excluded.data`,
					deletedAt: null,
				},
			});
	if (enqueueProjection)
		await tx.insert(fundsJob).values({
			id: crypto.randomUUID(),
			caseId,
			actorId: actor.user.id,
			mode: "sync",
		});
}

export async function listCases(actor: Actor) {
	const { db } = getServerResources();
	return db
		.select()
		.from(fundsCase)
		.where(
			and(
				isNull(fundsCase.deletedAt),
				actor.user.role === "admin"
					? undefined
					: eq(fundsCase.ownerId, actor.user.id),
			),
		)
		.orderBy(
			asc(fundsCase.sortOrder),
			desc(fundsCase.createdAt),
			asc(fundsCase.id),
		);
}
export async function createCase(actor: Actor, name: string) {
	const [record] = await getServerResources()
		.db.insert(fundsCase)
		.values({
			id: crypto.randomUUID(),
			name: name.trim(),
			ownerId: actor.user.id,
		})
		.returning();
	if (!record) throw new Error("案件创建失败");
	return record;
}

/** 整批文件先解析，再原子写入；任一不支持文件阻止整批提交。重复文件不产生新版本。 */
export async function importStatements(
	actor: Actor,
	caseId: string,
	files: { name: string; bytes: Uint8Array }[],
) {
	await findCase(actor, caseId);
	if (
		!files.length ||
		files.length > 32 ||
		files.reduce((sum, file) => sum + file.bytes.length, 0) > 100 * 1024 * 1024
	)
		throw new AccessError(
			400,
			"IMPORT_LIMIT",
			"每批请选择 1–32 个文件，总大小不超过 100 MB。",
		);
	const parsed = files.map((file) => {
		try {
			return {
				source: parseStatement(
					file.name.replaceAll("\\", "/").split("/").pop() ?? "流水",
					file.bytes,
				),
				file,
			};
		} catch (error) {
			throw new AccessError(
				400,
				"IMPORT_REJECTED",
				`${file.name}：${error instanceof Error ? error.message : "解析失败"}。本批未写入。`,
			);
		}
	});
	const result = await commitPreparedSources(actor, caseId, parsed);
	const projection = await synchronize(actor, caseId);
	return { ...result, ...projection };
}

/** 后台提交已校验的标准化结果；租约令牌防止过期 worker 写入。 */
export async function commitPreparedSources(
	actor: Actor,
	caseId: string,
	parsed: {
		source: ParsedSource;
		file: { name: string; bytes: Uint8Array };
		fileRef?: FundsFileRef;
	}[],
	lease?: { jobId: string; owner: string },
) {
	await findCase(actor, caseId);
	const stored: ((typeof parsed)[number] & { fileRef: FundsFileRef })[] = [];
	for (const item of parsed)
		stored.push({
			...item,
			fileRef: item.fileRef ?? (await saveOriginal(caseId, item.file.bytes)),
		});
	return getServerResources().db.transaction(async (tx) => {
		const record = await lockCase(tx, actor, caseId);
		if (lease) {
			const [job] = await tx
				.select()
				.from(fundsJob)
				.where(eq(fundsJob.id, lease.jobId))
				.for("update");
			if (!job || job.leaseOwner !== lease.owner || job.status !== "running")
				throw new Error("任务租约已经转移，停止提交。");
		}
		const existing = await sourcesFor(caseId, tx);
		const ids = new Set(
			existing
				.filter(
					(s) =>
						!parsed.some(
							({ source }) =>
								source.id === s.id &&
								source.normalization &&
								(!s.normalization ||
									source.normalization.converterVersion !==
										s.normalization.converterVersion ||
									source.normalization.promptVersion !==
										s.normalization.promptVersion),
						),
				)
				.map((source) => source.id),
		);
		const added = stored.filter(({ source }) => {
			if (ids.has(source.id)) return false;
			ids.add(source.id);
			return true;
		});
		if (!added.length)
			return { added: 0, skipped: parsed.length, revision: record.revision };
		const replacing = new Set(added.map((a) => a.source.id));
		const sources = [
			...existing.filter((s) => !replacing.has(s.id)),
			...added.map((entry) => entry.source),
		];
		if (sources.reduce((n, s) => n + s.rows.length, 0) > 100_000)
			throw new AccessError(
				400,
				"CASE_LIMIT",
				"首版单案最多 100,000 条原始记录，本批未写入。",
			);
		const [previous] = await tx
			.select()
			.from(fundsRevision)
			.where(
				and(
					eq(fundsRevision.caseId, caseId),
					eq(fundsRevision.revision, record.revision),
				),
			);
		const decisions = (previous?.decisions ?? []) as MatchDecision[];
		const snapshot = reconcile(sources, decisions);
		for (const { source, fileRef } of added)
			await tx
				.insert(fundsSource)
				.values({
					caseId,
					id: source.id,
					name: source.name,
					fileRef,
					parsed: source,
				})
				.onConflictDoUpdate({
					target: [fundsSource.caseId, fundsSource.id],
					set: { parsed: source, active: true, fileRef, bytesBase64: null },
				});
		await saveRevision(
			tx,
			actor,
			caseId,
			record.revision + 1,
			`import:${added.length}`,
			snapshot,
			decisions,
			!lease,
		);
		return {
			added: added.length,
			skipped: parsed.length - added.length,
			revision: record.revision + 1,
		};
	});
}

/** 持有案件锁重放最新完整版本；失败返回待同步状态，已保存的原文不回滚。 */
export async function synchronize(actor: Actor, caseId: string) {
	const { db, fundsGraph } = getServerResources();
	await findCase(actor, caseId);
	if (!fundsGraph)
		return {
			graphReady: false,
			message: "原文已保存，图服务未配置，请配置后重试同步。",
		};
	try {
		await db.transaction(async (tx) => {
			const record = await lockCase(tx, actor, caseId);
			if (record.revision === record.graphRevision) return;
			const [version] = await tx
				.select()
				.from(fundsRevision)
				.where(
					and(
						eq(fundsRevision.caseId, caseId),
						eq(fundsRevision.revision, record.revision),
					),
				);
			if (!version) throw new Error("缺少可重放的案件版本");
			await fundsGraph.project(
				caseId,
				record.revision,
				version.snapshot as FundsSnapshot,
			);
			await tx
				.update(fundsCase)
				.set({ graphRevision: record.revision })
				.where(eq(fundsCase.id, caseId));
		});
		return { graphReady: true, message: "案件数据已保存，资金图已同步。" };
	} catch {
		return {
			graphReady: false,
			message:
				"原文与清洗结果已保存，图同步失败。请检查 Neo4j 后点击重试同步。",
		};
	}
}

/** 核对采用乐观版本校验，避免旧页面决定覆盖新增证据。 */
export async function decideMatch(
	actor: Actor,
	caseId: string,
	candidateId: string,
	action: "merge" | "separate",
	expectedRevision: number,
) {
	await getServerResources().db.transaction(async (tx) => {
		const record = await lockCase(tx, actor, caseId);
		if (record.revision !== expectedRevision)
			throw new AccessError(
				409,
				"STALE_CASE",
				"案件已有新版本，请刷新后重新核对。",
			);
		const [version] = await tx
			.select()
			.from(fundsRevision)
			.where(
				and(
					eq(fundsRevision.caseId, caseId),
					eq(fundsRevision.revision, record.revision),
				),
			);
		const snapshot = version?.snapshot as FundsSnapshot | undefined;
		const candidate = snapshot?.candidates.find((c) => c.id === candidateId);
		if (!candidate)
			throw new AccessError(
				409,
				"MATCH_CHANGED",
				"此配对已处理或发生变化，请刷新。",
			);
		const decisions: MatchDecision[] = [
			...((version?.decisions as MatchDecision[]) ?? []),
			{
				left: candidate.left,
				right: candidate.right,
				action,
				actor: actor.user.id,
				at: new Date().toISOString(),
			},
		];
		const sources = await sourcesFor(caseId, tx);
		await saveRevision(
			tx,
			actor,
			caseId,
			record.revision + 1,
			`match:${action}`,
			reconcile(sources, decisions),
			decisions,
		);
	});
	return { graphReady: false, message: "核对决定已保存，后台正在更新资金图。" };
}

export async function caseDetails(actor: Actor, caseId: string) {
	const record = await findCase(actor, caseId);
	const [{ snapshot }, sources, sourceMeta] = await Promise.all([
		latest(caseId, record.revision),
		sourcesFor(caseId),
		getServerResources()
			.db.select({ id: fundsSource.id, inclusionId: fundsSource.inclusionId })
			.from(fundsSource)
			.where(eq(fundsSource.caseId, caseId)),
	]);
	const history = await getServerResources()
		.db.select({
			revision: fundsRevision.revision,
			action: fundsRevision.action,
			actorId: fundsRevision.actorId,
			createdAt: fundsRevision.createdAt,
		})
		.from(fundsRevision)
		.where(eq(fundsRevision.caseId, caseId))
		.orderBy(desc(fundsRevision.revision))
		.limit(20);
	return {
		...record,
		totals: snapshot.totals,
		sources: sources.map(
			({
				id,
				name,
				size,
				encoding,
				rows,
				observations,
				issues,
				feedbackCount,
				auxiliaryCount,
			}) => ({
				id,
				name,
				isSnapshot: !!sourceMeta.find((item) => item.id === id)?.inclusionId,
				size,
				encoding,
				rowCount: rows.length,
				observations: observations.length,
				issues: issues.length,
				feedbackCount,
				auxiliaryCount,
			}),
		),
		history,
	};
}
export async function reviewData(
	actor: Actor,
	caseId: string,
	offset: number,
	kind: string,
) {
	const record = await findCase(actor, caseId);
	const { snapshot } = await latest(caseId, record.revision);
	const issues = snapshot.issues.filter(
		(issue) => !kind || issue.kind === kind,
	);
	return {
		issues: issues.slice(offset, offset + 50),
		total: issues.length,
		candidates: snapshot.candidates.slice(offset, offset + 50),
		candidateTotal: snapshot.candidates.length,
	};
}
export async function sourceRow(
	actor: Actor,
	caseId: string,
	sourceId: string,
	sheet: string,
	rowNumber: number,
) {
	await findCase(actor, caseId);
	const [source] = await getServerResources()
		.db.select()
		.from(fundsSource)
		.where(
			and(
				eq(fundsSource.caseId, caseId),
				eq(fundsSource.id, sourceId),
				eq(fundsSource.active, true),
			),
		);
	const row = (source?.parsed as ParsedSource | undefined)?.rows.find(
		(r) => r.sheet === sheet && r.row === rowNumber,
	);
	if (!row) throw new AccessError(404, "ROW_NOT_FOUND", "来源行不存在。");
	return { file: source?.name ?? "", sha256: sourceId, ...row };
}
export async function exportStandardized(actor: Actor, caseId: string) {
	await findCase(actor, caseId);
	const sources = await sourcesFor(caseId);
	try {
		return csvDocument(standardHeaders, sources.flatMap(standardRows));
	} catch (error) {
		if (error instanceof RangeError)
			throw new AccessError(400, "STANDARD_EXPORT_UNSUPPORTED", error.message);
		throw error;
	}
}
export async function evidence(
	actor: Actor,
	caseId: string,
	transactionId: string,
) {
	const record = await findCase(actor, caseId);
	const { snapshot } = await latest(caseId, record.revision);
	const transaction = snapshot.transactions.find(
		(t) => t.id === transactionId || t.groupIds?.includes(transactionId),
	);
	if (!transaction)
		throw new AccessError(
			404,
			"TRANSACTION_NOT_FOUND",
			"交易不存在或已归并，请刷新列表。",
		);
	const ids = new Set(transaction.evidenceIds);
	const sources = await sourcesFor(caseId);
	return {
		transaction,
		observations: sources.flatMap((source) =>
			source.observations
				.filter((o) => ids.has(o.id))
				.map((o) => ({
					...o,
					file: source.name,
					raw:
						source.rows.find((r) => r.sheet === o.sheet && r.row === o.row)
							?.fields ?? {},
				})),
		),
	};
}

async function graphFor(actor: Actor, caseId: string) {
	const record = await findCase(actor, caseId);
	if (record.revision !== record.graphRevision)
		throw new AccessError(
			409,
			"GRAPH_PENDING",
			"资金图尚未同步到最新导入版本，请重试同步。",
		);
	const graph = getServerResources().fundsGraph;
	if (!graph) throw new AccessError(503, "GRAPH_UNAVAILABLE", "图服务未配置。");
	return graph;
}
async function graphQuery<T>(operation: () => Promise<T>) {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof AccessError) throw error;
		throw new AccessError(
			503,
			"GRAPH_UNAVAILABLE",
			"图查询暂不可用或范围过大，请检查服务或缩小时间范围后重试。",
		);
	}
}
export async function analysisSummary(actor: Actor, caseId: string) {
	return graphQuery(async () =>
		(await graphFor(actor, caseId)).summary(caseId),
	);
}
export async function listAccounts(
	actor: Actor,
	caseId: string,
	search: string,
) {
	return graphQuery(async () =>
		(await graphFor(actor, caseId)).accounts(caseId, search),
	);
}
export async function listTransactions(
	actor: Actor,
	caseId: string,
	filter: GraphFilter,
) {
	return graphQuery(async () =>
		(await graphFor(actor, caseId)).transactions(caseId, filter),
	);
}
/** 返回本案筛选范围的完整图；复用归属、删除状态及图版本校验，查询失败不返回局部结果。 */
export async function caseGraph(
	actor: Actor,
	caseId: string,
	filter: Omit<GraphFilter, "limit" | "offset">,
) {
	return graphQuery(async () =>
		(await graphFor(actor, caseId)).graph(caseId, filter),
	);
}
export async function traceTransactions(
	actor: Actor,
	caseId: string,
	input: {
		account: string;
		transaction: string;
		depth: number;
		from: string;
		to: string;
	},
) {
	return graphQuery(async () =>
		(await graphFor(actor, caseId)).trace(
			caseId,
			input.account,
			input.transaction,
			input.depth,
			input.from,
			input.to,
		),
	);
}

/** 案件列表状态独立于流水版本；权限失败返回 404，不改变资金数据。 */
export async function updateCase(
	actor: Actor,
	caseId: string,
	patch: { pinned?: boolean; archived?: boolean },
) {
	return getServerResources().db.transaction(async (tx) => {
		await lockCase(tx, actor, caseId);
		if (patch.pinned === undefined && patch.archived === undefined)
			throw new AccessError(400, "EMPTY_UPDATE", "请选择案件操作。");
		const [record] = await tx
			.update(fundsCase)
			.set({ pinned: patch.pinned, archived: patch.archived })
			.where(eq(fundsCase.id, caseId))
			.returning();
		if (!record) throw new Error("案件状态保存失败。");
		return record;
	});
}
/** 下载当前案的来源原件；跨案纳入的来源只提供获准范围的 CSV 快照。 */
export async function downloadSourceOriginal(
	actor: Actor,
	caseId: string,
	sourceId: string,
) {
	await findCase(actor, caseId);
	const [source] = await getServerResources()
		.db.select()
		.from(fundsSource)
		.where(
			and(
				eq(fundsSource.caseId, caseId),
				eq(fundsSource.id, sourceId),
				eq(fundsSource.active, true),
			),
		);
	if (!source)
		throw new AccessError(404, "SOURCE_NOT_FOUND", "该案件中没有此来源文件。");
	return originalResponse(
		source.inclusionId
			? `${source.name.replace(/\.[^.]+$/, "")}.纳入快照.csv`
			: source.name,
		await readStoredFile(caseId, source),
	);
}

/** 仅归档案件可标记删除；保留全部资料，取消未完成任务；不存在/越权 404，未归档 409。 */
export async function deleteCase(actor: Actor, caseId: string) {
	return getServerResources().db.transaction(async (tx) => {
		const record = await lockCase(tx, actor, caseId);
		if (!record.archived)
			throw new AccessError(
				409,
				"CASE_NOT_ARCHIVED",
				"请先归档案件，再在已归档列表中删除。",
			);
		const now = new Date();
		await tx
			.update(fundsCase)
			.set({ deletedAt: now, deletedBy: actor.user.id })
			.where(eq(fundsCase.id, caseId));
		await tx
			.update(fundsJob)
			.set({
				status: "cancelled",
				stage: "cancelled",
				error: "案件已删除，后台处理已停止；资料保留。",
				leaseOwner: null,
				leaseUntil: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(fundsJob.caseId, caseId),
					inArray(fundsJob.status, ["queued", "running", "failed"]),
				),
			);
		return { id: caseId, deletedAt: now };
	});
}

/** 在同一列表分组中移动；锁定可见案件，基于最新顺序插入，避免覆盖搜索隐藏项。 */
export async function moveCase(
	actor: Actor,
	caseId: string,
	targetId: string,
	placement: "before" | "after",
) {
	return getServerResources().db.transaction(async (tx) => {
		// 菜单排序串行化；按 ID 锁行与单案更新协调，资金任务不依赖此锁。
		await tx.execute(sql`select pg_advisory_xact_lock(1279607119, 3)`);
		const rows = await tx
			.select()
			.from(fundsCase)
			.where(
				and(
					isNull(fundsCase.deletedAt),
					actor.user.role === "admin"
						? undefined
						: eq(fundsCase.ownerId, actor.user.id),
				),
			)
			.orderBy(asc(fundsCase.id))
			.for("update");
		const record = checkOwner(
			actor,
			rows.find((r) => r.id === caseId),
		);
		const target = checkOwner(
			actor,
			rows.find((r) => r.id === targetId),
		);
		if (
			record.archived !== target.archived ||
			(!record.archived && record.pinned !== target.pinned)
		)
			throw new AccessError(
				409,
				"CASE_GROUP_CHANGED",
				"请在同一分组内排序；案件状态可能已变化，请刷新列表。",
			);
		const group = rows
			.filter(
				(r) =>
					r.archived === record.archived &&
					(record.archived || r.pinned === record.pinned),
			)
			.sort(
				(a, b) =>
					a.sortOrder - b.sortOrder ||
					b.createdAt.getTime() - a.createdAt.getTime() ||
					a.id.localeCompare(b.id),
			);
		if (caseId !== targetId) {
			const reordered = group.filter((r) => r.id !== caseId);
			reordered.splice(
				reordered.findIndex((r) => r.id === targetId) +
					(placement === "after" ? 1 : 0),
				0,
				record,
			);
			for (const [sortOrder, item] of reordered.entries())
				await tx
					.update(fundsCase)
					.set({ sortOrder })
					.where(eq(fundsCase.id, item.id));
			return reordered.map((r, sortOrder) => ({ ...r, sortOrder }));
		}
		return group;
	});
}
