/**
 * @file 多区域选区的起点、表头高亮和外周边界计算。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：按选区并集强调行列，区分活动起点并计算四边和内凹拐角。
 * 被调用：DataGrid、GridRow、GridCell；不读取 DOM，不枚举屏幕外行。
 * 预期结果：虚拟化与冻结列沿用单元格几何，拖选外框直接扩大而不追逐焦点。
 */
import type { CellRange } from "./core/types";

type Bounds = { r0: number; r1: number; c0: number; c1: number };

export const SelectionEdge = {
	top: 1,
	right: 2,
	bottom: 4,
	left: 8,
	selected: 16,
	concaveTopLeft: 32,
	concaveTopRight: 64,
	concaveBottomRight: 128,
	concaveBottomLeft: 256,
	anchor: 512,
} as const;

/** 仅强调含有有效选区的列，离散区域之间的空列保持原样。 */
export function selectionColumns(
	ranges: readonly Bounds[],
	columnCount: number,
): readonly boolean[] {
	return Array.from({ length: columnCount }, (_, column) =>
		ranges.some((range) => column >= range.c0 && column <= range.c1),
	);
}

/** 活动范围两端均可见时返回原始 anchor 坐标；反向选择不会改用左上角。 */
export function selectionAnchorCell(
	selection: CellRange | null,
	rowIndex: (rowId: string) => number,
	columns: readonly { id: string }[],
): { row: number; column: number } | undefined {
	if (!selection) return;
	const row = rowIndex(selection.anchor.rowId);
	const column = columns.findIndex(
		(item) => item.id === selection.anchor.columnId,
	);
	if (
		row < 0 ||
		column < 0 ||
		rowIndex(selection.focus.rowId) < 0 ||
		!columns.some((item) => item.id === selection.focus.columnId)
	)
		return;
	return { row, column };
}

/**
 * 返回一行各列的选中、边界和内凹补角位；0 表示未选中，普通内部格仅保留 selected 位。
 * 内凹补片归属于两个正交已选邻格之间的当前格，对角未选时才补齐描边交点。
 * @param ranges 当前可见数据坐标中的所有有效选区，允许重叠或相邻。
 * @param row 真实行索引，不能使用虚拟窗口内偏移。
 * @param columnCount 可见列定义数量，包括暂未挂载的列。
 * @param anchor 需要保留原底色的唯一活动起点；单格选择时由调用方省略。
 */
export function selectionRowCells(
	ranges: readonly Bounds[],
	row: number,
	columnCount: number,
	anchor?: { row: number; column: number },
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
		const top = contains(row - 1, column);
		const right = contains(row, column + 1);
		const bottom = contains(row + 1, column);
		const left = contains(row, column - 1);
		return (
			SelectionEdge.selected |
			(anchor?.row === row && anchor.column === column
				? SelectionEdge.anchor
				: 0) |
			(top ? 0 : SelectionEdge.top) |
			(right ? 0 : SelectionEdge.right) |
			(bottom ? 0 : SelectionEdge.bottom) |
			(left ? 0 : SelectionEdge.left) |
			(top && left && !contains(row - 1, column - 1)
				? SelectionEdge.concaveTopLeft
				: 0) |
			(top && right && !contains(row - 1, column + 1)
				? SelectionEdge.concaveTopRight
				: 0) |
			(bottom && right && !contains(row + 1, column + 1)
				? SelectionEdge.concaveBottomRight
				: 0) |
			(bottom && left && !contains(row + 1, column - 1)
				? SelectionEdge.concaveBottomLeft
				: 0)
		);
	});
}
