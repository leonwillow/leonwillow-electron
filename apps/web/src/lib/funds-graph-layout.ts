/**
 * @file 完整资金图的平行边曲率与自环位置计算。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：完整数据一次分组，避免画布变换逐边扫描全部边导致整案切换阻塞。
 * 被调用：graph-canvas 与测试；调用：有向边的稳定 ID。
 * 预期结果：每条边保留独立样式，往返曲线分开，自环轮换位置，复杂度 O(E)。
 */
type Edge = { id: string; from: string; to: string };
const loopPositions = [
	"top",
	"top-right",
	"right",
	"bottom-right",
	"bottom",
	"bottom-left",
	"left",
	"top-left",
] as const;
type EdgeStyle = {
	curveOffset?: number;
	loopPlacement?: (typeof loopPositions)[number];
	loopDist?: number;
};
export function fundsEdgeStyles(
	edges: Edge[],
	distance: number,
	loopBase: number,
) {
	const pairs = new Map<string, Edge[]>();
	for (const edge of edges) {
		const key = JSON.stringify(
			edge.from <= edge.to ? [edge.from, edge.to] : [edge.to, edge.from],
		);
		const group = pairs.get(key) ?? [];
		group.push(edge);
		pairs.set(key, group);
	}
	const styles = new Map<string, EdgeStyle>();
	for (const group of pairs.values())
		for (const [index, edge] of group.entries()) {
			styles.set(
				edge.id,
				edge.from === edge.to
					? {
							loopPlacement: loopPositions[index % loopPositions.length],
							loopDist:
								loopBase + Math.floor(index / loopPositions.length) * distance,
						}
					: {
							curveOffset:
								(index - (group.length - 1) / 2) *
								2 *
								distance *
								(edge.from <= edge.to ? 1 : -1),
						},
			);
		}
	return styles;
}
