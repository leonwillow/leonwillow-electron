/**
 * @file 资金图分析、交易查询、时间有序追踪与原始证据回溯服务。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：封装 Neo4j 投影查询与关系库原始证据行对齐，统一校验图同步版本。
 * 被调用：funds API 及离线导入核验脚本。
 * 调用：case-service、server-resources（Neo4j fundsGraph）。
 * 功能：读取案件汇总、账户列表、资金图、分页交易、路径追踪及单笔证据。
 * 预期结果：图未同步返回 409，图服务不可用返回 503，不暴露部分或陈旧图数据。
 */
import { getServerResources } from "../../server-resources";
import { AccessError } from "../access/service";
import { type Actor, findCase, latest, sourcesFor } from "./case-service";
import type { GraphFilter } from "./types";

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
