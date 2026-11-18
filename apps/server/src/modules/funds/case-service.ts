/**
 * @file 资金案件归属校验、版本持久化与目录生命周期服务。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：管理案件目录、归属锁、版本落库、原件下载与标准导出，供核对与图分析复用。
 * 被调用：funds API、reconcile-service、analysis-service、jobs、case-links 及离线脚本。
 * 调用：PostgreSQL/Drizzle、canonical、export、file-store、reconcile、subjects。
 * 功能：案件归属隔离、串行版本提交、排序与归档标记删除、来源原件下载。
 * 预期结果：删除仅标记且停止未完任务，不物理清除原始凭证与历史快照。
 */
import type { Database, DatabaseTransaction } from "@leonwillow-electron/db";
import {
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
import { originalResponse, readStoredFile } from "./file-store";
import { reconcile } from "./reconcile";
import { subjectSummary } from "./subjects";
import type {
	FundsSnapshot,
	FundsSubject,
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

export async function caseDetails(actor: Actor, caseId: string) {
	const record = await findCase(actor, caseId);
	const { db } = getServerResources();
	const [[revisionRow], sources, history] = await Promise.all([
		db
			.select({
				totals: sql<
					FundsSnapshot["totals"] | null
				>`${fundsRevision.snapshot}->'totals'`,
				subjects: sql<
					FundsSubject[] | null
				>`${fundsRevision.snapshot}->'subjects'`,
				subjectRuleVersion: sql<
					number | null
				>`(${fundsRevision.snapshot}->>'subjectRuleVersion')::int`,
			})
			.from(fundsRevision)
			.where(
				and(
					eq(fundsRevision.caseId, caseId),
					eq(fundsRevision.revision, record.revision),
				),
			),
		db
			.select({
				id: sql<string>`coalesce(${fundsSource.parsed}->>'id', ${fundsSource.id})`,
				name: sql<string>`coalesce(${fundsSource.parsed}->>'name', ${fundsSource.name})`,
				inclusionId: fundsSource.inclusionId,
				size: sql<number>`coalesce((${fundsSource.parsed}->>'size')::int, 0)`,
				encoding: sql<string>`coalesce(${fundsSource.parsed}->>'encoding', 'UTF-8')`,
				rowCount: sql<number>`coalesce(jsonb_array_length(${fundsSource.parsed}->'rows'), 0)`,
				observations: sql<number>`coalesce(jsonb_array_length(${fundsSource.parsed}->'observations'), 0)`,
				issues: sql<number>`coalesce(jsonb_array_length(${fundsSource.parsed}->'issues'), 0)`,
				feedbackCount: sql<number>`coalesce((${fundsSource.parsed}->>'feedbackCount')::int, 0)`,
				auxiliaryCount: sql<number>`coalesce((${fundsSource.parsed}->>'auxiliaryCount')::int, 0)`,
			})
			.from(fundsSource)
			.where(and(eq(fundsSource.caseId, caseId), eq(fundsSource.active, true))),
		db
			.select({
				revision: fundsRevision.revision,
				action: fundsRevision.action,
				actorId: fundsRevision.actorId,
				createdAt: fundsRevision.createdAt,
			})
			.from(fundsRevision)
			.where(eq(fundsRevision.caseId, caseId))
			.orderBy(desc(fundsRevision.revision))
			.limit(20),
	]);
	const fallback = revisionRow?.totals ? null : reconcile([]);
	return {
		...record,
		totals: revisionRow?.totals ?? fallback?.totals ?? reconcile([]).totals,
		subjectSummary: subjectSummary(
			revisionRow ? (revisionRow.subjects ?? undefined) : fallback?.subjects,
		),
		subjectRuleVersion:
			revisionRow?.subjectRuleVersion ?? fallback?.subjectRuleVersion ?? 1,
		sources: sources.map(
			({
				id,
				name,
				inclusionId,
				size,
				encoding,
				rowCount,
				observations,
				issues,
				feedbackCount,
				auxiliaryCount,
			}) => ({
				id,
				name,
				isSnapshot: !!inclusionId,
				size,
				encoding,
				rowCount,
				observations,
				issues,
				feedbackCount,
				auxiliaryCount,
			}),
		),
		history,
	};
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
