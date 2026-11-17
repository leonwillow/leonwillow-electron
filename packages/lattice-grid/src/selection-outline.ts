/**
 * @file 多区域选区的逐格高亮和外周边界计算。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：按选区并集判断四邻格，避免重叠区域出现内部边框。
 * 被调用：DataGrid、GridRow、GridCell；不读取 DOM，不枚举屏幕外行。
 * 预期结果：虚拟化与冻结列沿用单元格几何，拖选外框直接扩大而不追逐焦点。
 */
type Bounds = { r0: number; r1: number; c0: number; c1: number };

export const SelectionEdge = {
	top: 1,
	right: 2,
	bottom: 4,
	left: 8,
	selected: 16,
} as const;

/**
 * 返回一行各列的选中与边界位；0 表示未选中，内部格仅保留 selected 位。
 * @param ranges 当前可见数据坐标中的所有有效选区，允许重叠或相邻。
 * @param row 真实行索引，不能使用虚拟窗口内偏移。
 * @param columnCount 可见列定义数量，包括暂未挂载的列。
 */
export function selectionRowCells(
	ranges: readonly Bounds[],
	row: number,
	columnCount: number,
): readonly number[] {
	const nearby = ranges.filter(
		(range) => row >= range.r0 - 1 && row <= range.r1 + 1,
	);
	const contains = (r: number, c: number) =>
		nearby.some(
			(range) =>
				r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1,
		);
	return Array.from({ length: columnCount }, (_, column) => {
		if (!contains(row, column)) return 0;
		return (
			SelectionEdge.selected |
			(contains(row - 1, column) ? 0 : SelectionEdge.top) |
			(contains(row, column + 1) ? 0 : SelectionEdge.right) |
			(contains(row + 1, column) ? 0 : SelectionEdge.bottom) |
			(contains(row, column - 1) ? 0 : SelectionEdge.left)
		);
	});
}
