/**
 * @file 跨案账户线索提示与用户确认的资料快照纳入/排除。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-21
 * 版本作用：提示仅按 SQL JSONB 投影账户清单，避免全库快照 N+1；纳入先上传对象存储再短事务落库。
 * 被调用：funds API；调用：案件权限、版本提交和标准导出。
 * 预期结果：不同案件默认隔离；排除只撤销本次纳入，原有来源仍保留。
 */

import {
	type FundsFileRef,
	fundsCase,
	fundsInclusion,
	fundsRevision,
	fundsSource,
} from "@leonwillow-electron/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError } from "../access/service";
import {
	type Actor,
	findCase,
	lockCase,
	saveRevision,
	sourcesFor,
} from "./case-service";
import { csvDocument, standardHeaders, standardRows } from "./export";
import { saveOriginal } from "./file-store";
import { digest } from "./parser";
import { reconcile } from "./reconcile";
import type { FundsAccount, MatchDecision, ParsedSource } from "./types";

/** 仅返回相同账号出现在哪个可访问案件；单条 SQL 仅投影 snapshot->'accounts'，不传输完整交易快照。 */
export async function caseLinks(actor: Actor, caseId: string) {
	await findCase(actor, caseId);
	const { db } = getServerResources();
	const [caseSnapshots, inclusions] = await Promise.all([
		db
			.select({
				id: fundsCase.id,
				name: fundsCase.name,
				revision: fundsCase.revision,
				accounts: sql<
					FundsAccount[] | null
				>`${fundsRevision.snapshot}->'accounts'`,
			})
			.from(fundsCase)
			.leftJoin(
				fundsRevision,
				and(
					eq(fundsRevision.caseId, fundsCase.id),
					eq(fundsRevision.revision, fundsCase.revision),
				),
			)
			.where(
				and(
					isNull(fundsCase.deletedAt),
					actor.user.role === "admin"
						? undefined
						: eq(fundsCase.ownerId, actor.user.id),
				),
			),
		db
			.select()
			.from(fundsInclusion)
			.where(eq(fundsInclusion.caseId, caseId))
			.orderBy(desc(fundsInclusion.createdAt)),
	]);
	const currentRow = caseSnapshots.find((row) => row.id === caseId);
	const accounts = new Set(
		(currentRow?.accounts ?? []).filter((a) => !a.unknown).map((a) => a.number),
	);
	const matches: {
		originCaseId: string;
		originCaseName: string;
		account: string;
		name: string;
		revision: number;
	}[] = [];
	if (accounts.size) {
		for (const other of caseSnapshots) {
			if (other.id === caseId) continue;
			for (const account of other.accounts ?? []) {
				if (accounts.has(account.number)) {
					matches.push({
						originCaseId: other.id,
						originCaseName: other.name,
						account: account.number,
						name: account.ownNames[0] || account.names[0] || "户名待确认",
						revision: other.revision,
					});
				}
			}
		}
	}
	return { matches, inclusions };
}

/** 用户明确指定来源案件/账户/版本后，先在事务外准备快照并上传对象存储，再持短锁原子落库。 */
export async function includeCaseAccount(
	actor: Actor,
	caseId: string,
	originCaseId: string,
	account: string,
	expectedRevision: number,
) {
	if (caseId === originCaseId)
		throw new AccessError(400, "SAME_CASE", "不能从当前案件向自身纳入资料。");
	await findCase(actor, caseId);
	const initialOrigin = await findCase(actor, originCaseId);
	if (initialOrigin.revision !== expectedRevision)
		throw new AccessError(
			409,
			"SOURCE_CASE_CHANGED",
			"来源案件已有更新，请刷新提示后重新确认。",
		);
	const inclusionId = crypto.randomUUID();
	const originalSources = await sourcesFor(originCaseId);
	const preparedCopies: { copy: ParsedSource; fileRef: FundsFileRef }[] = [];
	for (const source of originalSources) {
		const observations = source.observations.filter(
			(o) => o.ownerAccount === account || o.otherAccount === account,
		);
		if (!observations.length) continue;
		const id = digest(`${inclusionId}:${source.id}`);
		const rows = new Set(observations.map((o) => `${o.sheet}:${o.row}`));
		const copy: ParsedSource = {
			...source,
			id,
			sha256: id,
			name: `纳入 · ${initialOrigin.name} · ${source.name}`,
			observations: observations.map((o) => ({
				...o,
				id: digest(`${id}:${o.sheet}:${o.row}`),
				sourceId: id,
			})),
			rows: source.rows.filter((r) => rows.has(`${r.sheet}:${r.row}`)),
			issues: [],
			auxiliaryCount: 0,
			feedbackCount: 0,
		};
		if (copy.observations.some((o) => o.currency !== "CNY"))
			throw new AccessError(
				400,
				"UNSUPPORTED_CURRENCY",
				"当前仅支持人民币（CNY）流水，来源案件包含历史外币记录，无法纳入。",
			);
		const csv = csvDocument(standardHeaders, standardRows(copy));
		copy.size = Buffer.byteLength(csv);
		const fileRef = await saveOriginal(caseId, new TextEncoder().encode(csv));
		preparedCopies.push({ copy, fileRef });
	}
	if (!preparedCopies.length)
		throw new AccessError(
			404,
			"ACCOUNT_DATA_MISSING",
			"来源案件没有该账户相关的可纳入流水。",
		);
	await getServerResources().db.transaction(async (tx) => {
		// 两个案件按固定顺序加锁，避免双向纳入死锁；此时对象存储已上传完毕，不持锁跨网络。
		const records = new Map<string, Awaited<ReturnType<typeof lockCase>>>();
		for (const id of [caseId, originCaseId].sort())
			records.set(id, await lockCase(tx, actor, id));
		const target = records.get(caseId);
		const origin = records.get(originCaseId);
		if (!target || !origin || origin.revision !== expectedRevision)
			throw new AccessError(
				409,
				"SOURCE_CASE_CHANGED",
				"来源案件已有更新，请刷新提示后重新确认。",
			);
		const [existing] = await tx
			.select()
			.from(fundsInclusion)
			.where(
				and(
					eq(fundsInclusion.caseId, caseId),
					eq(fundsInclusion.originCaseId, originCaseId),
					eq(fundsInclusion.account, account),
					eq(fundsInclusion.active, true),
				),
			);
		if (existing)
			throw new AccessError(
				409,
				"ALREADY_INCLUDED",
				"该账户已有有效纳入，若需更新资料请先排除原快照再纳入。",
			);
		for (const { copy, fileRef } of preparedCopies) {
			await tx.insert(fundsSource).values({
				caseId,
				id: copy.id,
				name: copy.name,
				fileRef,
				parsed: copy,
				inclusionId,
			});
		}
		await tx.insert(fundsInclusion).values({
			id: inclusionId,
			caseId,
			originCaseId,
			originRevision: origin.revision,
			account,
			actorId: actor.user.id,
		});
		const sources = await sourcesFor(caseId, tx);
		if (sources.reduce((n, s) => n + s.rows.length, 0) > 100_000)
			throw new AccessError(
				400,
				"CASE_LIMIT",
				"纳入后超过单案 100,000 行限制，本次未纳入。",
			);
		const [version] = await tx
			.select({ decisions: fundsRevision.decisions })
			.from(fundsRevision)
			.where(
				and(
					eq(fundsRevision.caseId, caseId),
					eq(fundsRevision.revision, target.revision),
				),
			);
		const decisions = (version?.decisions ?? []) as MatchDecision[];
		await saveRevision(
			tx,
			actor,
			caseId,
			target.revision + 1,
			`include:${inclusionId}`,
			reconcile(sources, decisions),
			decisions,
		);
	});
	return {
		id: inclusionId,
		message: "已纳入所选账户的资料快照，后台正在更新资金图。",
	};
}

export async function excludeCaseAccount(
	actor: Actor,
	caseId: string,
	inclusionId: string,
) {
	await getServerResources().db.transaction(async (tx) => {
		const record = await lockCase(tx, actor, caseId);
		const [inclusion] = await tx
			.update(fundsInclusion)
			.set({ active: false })
			.where(
				and(
					eq(fundsInclusion.id, inclusionId),
					eq(fundsInclusion.caseId, caseId),
					eq(fundsInclusion.active, true),
				),
			)
			.returning();
		if (!inclusion)
			throw new AccessError(
				404,
				"INCLUSION_MISSING",
				"该纳入记录不存在或已经排除。",
			);
		await tx
			.update(fundsSource)
			.set({ active: false })
			.where(
				and(
					eq(fundsSource.caseId, caseId),
					eq(fundsSource.inclusionId, inclusionId),
				),
			);
		const [version] = await tx
			.select({ decisions: fundsRevision.decisions })
			.from(fundsRevision)
			.where(
				and(
					eq(fundsRevision.caseId, caseId),
					eq(fundsRevision.revision, record.revision),
				),
			);
		const decisions = (version?.decisions ?? []) as MatchDecision[];
		await saveRevision(
			tx,
			actor,
			caseId,
			record.revision + 1,
			`exclude:${inclusionId}`,
			reconcile(await sourcesFor(caseId, tx), decisions),
			decisions,
		);
	});
	return { message: "本次纳入已排除，原有资料保留，后台正在更新资金图。" };
}
