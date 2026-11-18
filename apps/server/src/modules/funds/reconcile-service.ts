/**
 * @file 资金流水导入提交、图同步、配对核对与主体归属调整服务。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：承接文件解析提交、Neo4j 重放同步、对手核对决定及案件主体调整。
 * 被调用：funds API、jobs 队列及离线导入脚本。
 * 调用：case-service、file-store、parser、reconcile、subjects、PostgreSQL 与 Neo4j。
 * 功能：文件幂等导入、租约校验提交、乐观版本核对与主体合并拆分。
 * 预期结果：PG 事务持久化后才投影图，版本冲突返回 409 且不覆盖新证据。
 */
import {
	type FundsFileRef,
	fundsCase,
	fundsJob,
	fundsRevision,
	fundsSource,
} from "@leonwillow-electron/db/schema";
import { and, eq } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError } from "../access/service";
import {
	type Actor,
	findCase,
	latest,
	lockCase,
	saveRevision,
	sourcesFor,
} from "./case-service";
import { saveOriginal } from "./file-store";
import { parseStatement } from "./parser";
import { reconcile } from "./reconcile";
import { subjectSummary } from "./subjects";
import type {
	FundsSnapshot,
	MatchDecision,
	ParsedSource,
	SubjectOverride,
} from "./types";

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
			.select({ decisions: fundsRevision.decisions })
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

/** 查看当前案件归属及调整历史；不返回其他案件的身份资料。 */
export async function subjectData(actor: Actor, caseId: string) {
	const record = await findCase(actor, caseId);
	const { snapshot } = await latest(caseId, record.revision);
	return {
		revision: record.revision,
		groups: snapshot.subjects ?? [],
		accounts: snapshot.accounts,
		overrides: snapshot.subjectOverrides ?? [],
		summary: subjectSummary(snapshot.subjects),
	};
}

/** 新规则重识别由 Worker 执行；任务重试不重复创建版本，租约转移后禁止提交。 */
export async function rescanSubjects(
	actor: Actor,
	caseId: string,
	lease: { jobId: string; owner: string },
) {
	return getServerResources().db.transaction(async (tx) => {
		const record = await lockCase(tx, actor, caseId);
		const [job] = await tx
			.select()
			.from(fundsJob)
			.where(eq(fundsJob.id, lease.jobId))
			.for("update");
		if (
			!job ||
			job.caseId !== caseId ||
			job.leaseOwner !== lease.owner ||
			job.status !== "running"
		)
			throw new Error("任务租约已经转移，停止提交。");
		const [done] = await tx
			.select({ revision: fundsRevision.revision })
			.from(fundsRevision)
			.where(
				and(
					eq(fundsRevision.caseId, caseId),
					eq(fundsRevision.action, `subjects:scan:${job.id}`),
				),
			);
		if (done) return;
		const { snapshot, decisions } = await latest(caseId, record.revision);
		await saveRevision(
			tx,
			actor,
			caseId,
			record.revision + 1,
			`subjects:scan:${job.id}`,
			snapshot,
			decisions,
			false,
		);
	});
}

/** 归属更正只改主体映射；原账户、交易和证据不变，撤销采用删除标记。旧版本提交返回 409。 */
export async function adjustSubjects(
	actor: Actor,
	caseId: string,
	expectedRevision: number,
	change:
		| { action: "merge" | "separate"; accounts: string[]; name?: string }
		| { undo: string },
) {
	await getServerResources().db.transaction(async (tx) => {
		const record = await lockCase(tx, actor, caseId);
		if (record.revision !== expectedRevision)
			throw new AccessError(
				409,
				"STALE_CASE",
				"案件已有新版本，请刷新后重新调整。",
			);
		const { snapshot, decisions } = await latest(caseId, record.revision);
		const overrides: SubjectOverride[] = structuredClone(
			snapshot.subjectOverrides ?? [],
		);
		if ("undo" in change) {
			const decision = overrides.find(
				(item) => item.id === change.undo && !item.deletedAt,
			);
			if (!decision)
				throw new AccessError(
					404,
					"OVERRIDE_NOT_FOUND",
					"此归属调整不存在或已撤销。",
				);
			decision.deletedAt = new Date().toISOString();
		} else {
			const accounts = [...new Set(change.accounts)];
			if (
				accounts.length < 2 ||
				accounts.some(
					(id) => !snapshot.accounts.some((a) => a.id === id && !a.unknown),
				)
			)
				throw new AccessError(
					400,
					"INVALID_ACCOUNTS",
					"请选择当前案件至少两个有效账户。",
				);
			overrides.push({
				id: crypto.randomUUID(),
				accounts,
				action: change.action,
				name: change.name?.trim() ?? "",
				actor: actor.user.id,
				at: new Date().toISOString(),
			});
		}
		snapshot.subjectOverrides = overrides;
		await saveRevision(
			tx,
			actor,
			caseId,
			record.revision + 1,
			"undo" in change ? "subjects:undo" : `subjects:${change.action}`,
			snapshot,
			decisions,
		);
	});
	return { message: "主体归属已保存，后台正在更新资金图。" };
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
		.db.select({ name: fundsSource.name, parsed: fundsSource.parsed })
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
