/**
 * @file 画布悬停速览的内存索引。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：将已加载的当前视图数据转换为节点或连线摘要，不依赖请求层。
 * 被调用：GraphHoverPreview 与测试；调用：summarizeNode。
 * 功能：一次构建邻接索引，节点统计按需缓存；往返及币种分别统计。
 * 预期结果：鼠标移动只读取内存，切换图数据时由组件替换整个索引。
 */
import type { FundsAccount } from "./funds";
import type { AnalysisEdge, AnalysisGraph } from "./funds-analysis";
import { summarizeNode } from "./funds-graph-presentation";

export type GraphPreviewTarget = { kind: "node" | "edge"; id: string };
export type GraphPreview =
	| {
			kind: "node";
			node: FundsAccount;
			summary: ReturnType<typeof summarizeNode>;
	  }
	| {
			kind: "edge";
			edge: AnalysisEdge;
			from?: FundsAccount;
			to?: FundsAccount;
	  };

/** 输入需是当前不可变视图；缺失目标返回 null，持有者在换图时丢弃索引和缓存。 */
export function createGraphPreviewIndex(data: AnalysisGraph) {
	const nodes = new Map(data.nodes.map((node) => [node.id, node]));
	const edges = new Map(data.edges.map((edge) => [edge.id, edge]));
	const adjacent = new Map<string, AnalysisEdge[]>();
	const cached = new Map<string, GraphPreview>();
	for (const edge of data.edges) {
		for (const id of new Set([edge.from, edge.to])) {
			const list = adjacent.get(id) ?? [];
			list.push(edge);
			adjacent.set(id, list);
		}
	}
	return {
		get(target: GraphPreviewTarget): GraphPreview | null {
			const key = JSON.stringify([target.kind, target.id]);
			const hit = cached.get(key);
			if (hit) return hit;
			let result: GraphPreview;
			if (target.kind === "node") {
				const node = nodes.get(target.id);
				if (!node) return null;
				result = {
					kind: "node",
					node,
					summary: summarizeNode(
						{ edges: adjacent.get(node.id) ?? [] },
						node.id,
					),
				};
			} else {
				const edge = edges.get(target.id);
				if (!edge) return null;
				result = {
					kind: "edge",
					edge,
					from: nodes.get(edge.from),
					to: nodes.get(edge.to),
				};
			}
			cached.set(key, result);
			return result;
		},
	};
}
