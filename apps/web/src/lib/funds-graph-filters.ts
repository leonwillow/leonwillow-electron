/**
 * @file 图谱节点与连线筛选规则。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：对当前展示粒度筛选，保留命中节点的往来对手和原交易 ID。
 * 被调用：analysis-panel、graph-toolbar 与测试；调用：资金视图类型。
 * 预期结果：图和明细一致，金额精确到分，筛选不改变案件事实。
 */
import type { AnalysisGraph, EdgeMode } from "./funds-analysis";
import type { NodePresentation } from "./funds-graph-presentation";

export type NodeFilter = {
	query: string;
	coverage: "all" | "statement" | "counterparty";
	mark: "all" | "marked" | "unmarked";
	scope: "neighbors" | "matched";
};
export type EdgeFilter = {
	minAmount: string;
	maxAmount: string;
	minCount: string;
	currency: string;
	internal: "all" | "exclude" | "only";
};
export const emptyNodeFilter: NodeFilter = {
	query: "",
	coverage: "all",
	mark: "all",
	scope: "neighbors",
};
export const emptyEdgeFilter: EdgeFilter = {
	minAmount: "",
	maxAmount: "",
	minCount: "",
	currency: "",
	internal: "all",
};

/** 输入为非负十进制主币单位；空值无约束，无效精度返回 null，禁止浮点取整。 */
export function amountToMinor(value: string): bigint | null {
	if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
	const [whole = "0", fraction = ""] = value.trim().split(".");
	return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function edgeFilterError(filter: EdgeFilter, mode: EdgeMode): string {
	const min = amountToMinor(filter.minAmount);
	const max = amountToMinor(filter.maxAmount);
	if ((filter.minAmount && min === null) || (filter.maxAmount && max === null))
		return "金额请填写非负数字，最多两位小数。";
	if (min !== null && max !== null && min > max)
		return "最高金额不能小于最低金额。";
	if (mode === "flow" && filter.minCount && !/^[1-9]\d*$/.test(filter.minCount))
		return "最低交易笔数请填写大于 0 的整数。";
	return "";
}

export function hasNodeFilter(filter: NodeFilter) {
	return (
		!!filter.query.trim() || filter.coverage !== "all" || filter.mark !== "all"
	);
}
export function hasEdgeFilter(filter: EdgeFilter, mode: EdgeMode) {
	return (
		!!(
			filter.minAmount ||
			filter.maxAmount ||
			filter.currency ||
			(mode === "flow" && filter.minCount)
		) || filter.internal !== "all"
	);
}

/** 金额/笔数按当前逐笔或汇总值判断；邻接模式只保留与命中节点相连的边，不扩散到对手之间。 */
export function filterGraph(
	graph: AnalysisGraph,
	nodes: NodeFilter,
	edges: EdgeFilter,
	mode: EdgeMode,
	presentation: Record<string, NodePresentation>,
): AnalysisGraph {
	const nodeActive = hasNodeFilter(nodes);
	const edgeActive = hasEdgeFilter(edges, mode);
	if (!nodeActive && !edgeActive) return graph;
	const query = nodes.query.trim().toLocaleLowerCase();
	const matches = new Set(
		graph.nodes
			.filter(
				(n) =>
					(!query ||
						[...n.names, ...n.ownNames, ...n.accountNumbers, n.number].some(
							(s) => s.toLocaleLowerCase().includes(query),
						)) &&
					(nodes.coverage === "all" ||
						(nodes.coverage === "statement"
							? n.hasStatement
							: !n.hasStatement)) &&
					(nodes.mark === "all" ||
						(nodes.mark === "marked"
							? !!presentation[n.id]?.marked
							: !presentation[n.id]?.marked)),
			)
			.map((n) => n.id),
	);
	const min = amountToMinor(edges.minAmount);
	const max = amountToMinor(edges.maxAmount);
	const count =
		mode === "flow" && /^[1-9]\d*$/.test(edges.minCount)
			? BigInt(edges.minCount)
			: null;
	const filtered = graph.edges.filter((e) => {
		if (
			nodeActive &&
			!(nodes.scope === "matched"
				? matches.has(e.from) && matches.has(e.to)
				: matches.has(e.from) || matches.has(e.to))
		)
			return false;
		if (edges.internal === "exclude" && e.from === e.to) return false;
		if (edges.internal === "only" && e.from !== e.to) return false;
		if (edges.currency && e.currency !== edges.currency) return false;
		const amount = BigInt(e.amountMinor);
		return (
			(min === null || amount >= min) &&
			(max === null || amount <= max) &&
			(count === null || BigInt(e.count) >= count)
		);
	});
	const included = new Set(filtered.flatMap((e) => [e.from, e.to]));
	return {
		nodes: graph.nodes.filter(
			(n) =>
				included.has(n.id) || (nodeActive && !edgeActive && matches.has(n.id)),
		),
		edges: filtered,
	};
}
