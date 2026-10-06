/**
 * @file 跨案账户线索提示与用户确认的资料快照纳入/排除。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：提示不返回外案交易；纳入后成为目标案件的独立来源范围。
 * 被调用：funds API；调用：案件权限、版本提交和标准导出。
 * 预期结果：不同案件默认隔离；排除只撤销本次纳入，原有来源仍保留。
 */

import {
	fundsInclusion,
	fundsRevision,
	fundsSource,
} from "@leonwillow-electron/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError } from "../access/service";
import { csvDocument, standardHeaders, standardRows } from "./export";
import { saveOriginal } from "./file-store";
import { digest } from "./parser";
import { reconcile } from "./reconcile";
import {
	type Actor,
	findCase,
	latest,
	listCases,
	lockCase,
	saveRevision,
	sourcesFor,
} from "./service";
import type { MatchDecision, ParsedSource } from "./types";

/** 仅返回相同账号出现在哪个可访问案件；不返回交易、金额、余额、日期范围。 */
export async function caseLinks(actor: Actor, caseId: string) {
	const record = await findCase(actor, caseId);
	const current = await latest(caseId, record.revision);
	const accounts = new Set(
		current.snapshot.accounts.filter((a) => !a.unknown).map((a) => a.number),
	);
	const matches: {
		originCaseId: string;
		originCaseName: string;
		account: string;
		name: string;
		revision: number;
	}[] = [];
	for (const other of (await listCases(actor)).filter((c) => c.id !== caseId)) {
		const data = await latest(other.id, other.revision);
		for (const account of data.snapshot.accounts)
			if (accounts.has(account.number))
				matches.push({
					originCaseId: other.id,
					originCaseName: other.name,
					account: account.number,
					name: account.ownNames[0] || account.names[0] || "户名待确认",
					revision: other.revision,
				});
	}
	const inclusions = await getServerResources()
		.db.select()
		.from(fundsInclusion)
		.where(eq(fundsInclusion.caseId, caseId))
		.orderBy(desc(fundsInclusion.createdAt));
	return { matches, inclusions };
}

/** 用户明确指定来源案件/账户/版本后，复制只涉及该账户的资料，不建立实时跨案查询。 */
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
	await findCase(actor, originCaseId);
	const inclusionId = crypto.randomUUID();
	await getServerResources().db.transaction(async (tx) => {
		// 两个案件按固定顺序加锁，避免双向纳入死锁。
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
		const originalSources = await sourcesFor(originCaseId, tx);
		const copies: ParsedSource[] = [];
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
				name: `纳入 · ${origin.name} · ${source.name}`,
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
			const csv = csvDocument(standardHeaders, standardRows(copy));
			copy.size = Buffer.byteLength(csv);
			copies.push(copy);
			await tx.insert(fundsSource).values({
				caseId,
				id,
				name: copy.name,
				fileRef: await saveOriginal(caseId, new TextEncoder().encode(csv)),
				parsed: copy,
				inclusionId,
			});
		}
		if (!copies.length)
			throw new AccessError(
				404,
				"ACCOUNT_DATA_MISSING",
				"来源案件没有该账户相关的可纳入流水。",
			);
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
			.select()
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
			.select()
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
