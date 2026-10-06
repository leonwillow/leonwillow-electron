/**
 * @file 四种资金分析视图的纯数据投影。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：账户/主体与逐笔/汇总独立组合，不改写规范交易。
 * 被调用：analysis-panel、graph-canvas 与测试；调用：Eden 返回类型。
 * 预期结果：按方向与币种精确汇总，内部划转保留，每条汇总可展开原交易。
 */
import type {
	FundsAccount,
	FundsFilter,
	FundsGraph,
	FundsTransaction,
} from "./funds";

export type NodeMode = "account" | "subject";
export type EdgeMode = "transaction" | "flow";
export type AnalysisEdge = FundsTransaction & {
	transactionIds: string[];
	count: number;
	lastTimestamp: string;
	aggregated: boolean;
};
export type AnalysisGraph = { nodes: FundsAccount[]; edges: AnalysisEdge[] };
export type RawGraph = Pick<FundsGraph, "nodes" | "edges">;

/** 还原账户端点仅用交易原账号；未知账号仍使用原独立节点，禁止按空值归为一人。 */
export function projectAccounts(data: RawGraph, mode: NodeMode): RawGraph {
	if (mode === "subject") return data;
	const nodes = data.nodes.flatMap((n) =>
		n.accounts.length
			? n.accounts.map((a) => ({
					...n,
					...a,
					accounts: [a],
					accountNumbers: [a.id],
					identityStatus: a.unknown ? "unknown" : "account-owner",
					basis: "账户视图",
				}))
			: n.accountNumbers.length
				? n.accountNumbers.map((id) => ({
						...n,
						id,
						number: n.unknown ? n.number : id,
						accountNumbers: [id],
					}))
				: [n],
	);
	return {
		nodes,
		edges: data.edges.map((t) => ({
			...t,
			from: t.fromAccount,
			to: t.toAccount,
		})),
	};
}

/** 追踪图中的主体可能还持有其他卡，只画实际出现在路径上的账户。 */
export function projectTrace(data: RawGraph, mode: NodeMode): RawGraph {
	const graph = projectAccounts(data, mode);
	const ids = new Set(graph.edges.flatMap((t) => [t.from, t.to]));
	return {
		nodes: graph.nodes.filter((n) => ids.has(n.id)),
		edges: graph.edges,
	};
}

/** 过滤发生在聚合前，双方、日期与收支方向约束同一批交易。日期采用银行本地日期。 */
export function filterAnalysis(data: RawGraph, filter: FundsFilter): RawGraph {
	const { account, counterparty, from, to, direction } = filter;
	if (!account && !counterparty && !from && !to) return data;
	const edges = data.edges.filter((t) => {
		if (from && t.timestamp.slice(0, 10) < from) return false;
		if (to && t.timestamp.slice(0, 10) > to) return false;
		const outgoing = t.from === account || t.fromAccount === account;
		const incoming = t.to === account || t.toAccount === account;
		if (
			account &&
			!(direction === "out"
				? outgoing
				: direction === "in"
					? incoming
					: outgoing || incoming)
		)
			return false;
		if (counterparty) {
			const matchFrom =
				t.from === counterparty || t.fromAccount === counterparty;
			const matchTo = t.to === counterparty || t.toAccount === counterparty;
			if (
				account
					? !((outgoing && matchTo) || (incoming && matchFrom))
					: !(matchFrom || matchTo)
			)
				return false;
		}
		return true;
	});
	const ids = new Set(edges.flatMap((t) => [t.from, t.to]));
	return {
		nodes: data.nodes.filter((n) => ids.has(n.id) || n.id === account),
		edges,
	};
}

/** 绝不将双向交易抵销；金额用整数分 BigInt，相同主体内划转仍有独立方向条目。 */
export function aggregateAnalysis(
	data: RawGraph,
	mode: EdgeMode,
): AnalysisGraph {
	if (mode === "transaction")
		return {
			nodes: data.nodes,
			edges: data.edges.map((t) => ({
				...t,
				transactionIds: [t.id],
				count: 1,
				lastTimestamp: t.timestamp,
				aggregated: false,
			})),
		};
	const groups = new Map<string, AnalysisEdge>();
	for (const t of data.edges) {
		const id = `flow:${JSON.stringify([t.from, t.to, t.currency])}`;
		const existing = groups.get(id);
		if (existing) {
			existing.amountMinor = (
				BigInt(existing.amountMinor) + BigInt(t.amountMinor)
			).toString();
			existing.transactionIds.push(t.id);
			existing.count++;
			if (t.timestamp < existing.timestamp) existing.timestamp = t.timestamp;
			if (t.timestamp > existing.lastTimestamp)
				existing.lastTimestamp = t.timestamp;
		} else
			groups.set(id, {
				...t,
				id,
				transactionIds: [t.id],
				count: 1,
				lastTimestamp: t.timestamp,
				aggregated: true,
			});
	}
	return {
		nodes: data.nodes,
		edges: [...groups.values()].sort((a, b) =>
			BigInt(a.amountMinor) > BigInt(b.amountMinor)
				? -1
				: BigInt(a.amountMinor) < BigInt(b.amountMinor)
					? 1
					: a.id.localeCompare(b.id),
		),
	};
}

export function analysisDirectory(data: RawGraph, term: string) {
	const counts = new Map<string, number>();
	for (const t of data.edges)
		for (const id of new Set([t.from, t.to]))
			counts.set(id, (counts.get(id) ?? 0) + 1);
	const search = term.trim();
	return data.nodes
		.filter(
			(n) =>
				!n.unknown &&
				(!search ||
					[...n.names, ...n.ownNames, ...n.accountNumbers].some((v) =>
						v.includes(search),
					)),
		)
		.map((n) => ({ ...n, transactionCount: counts.get(n.id) ?? 0 }))
		.sort(
			(a, b) =>
				Number(b.hasStatement) - Number(a.hasStatement) ||
				b.transactionCount - a.transactionCount ||
				a.id.localeCompare(b.id),
		);
}
