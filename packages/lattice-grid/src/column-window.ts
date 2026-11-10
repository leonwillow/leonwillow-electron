/**
 * @file 大表正文的横向渲染窗口与等宽占位计划。
 * 创建时间：2026-11-08；修改时间：2026-11-08。
 * 版本作用：只减少屏幕外正文格的挂载，表头、汇总和完整列数据保持原布局。
 * 被调用：GridView 测量、DataGrid 与 GridRow；不读取 DOM 或修改数据。
 * 预期结果：可见列、相邻缓冲列、冻结列和当前编辑/选中列始终保留。
 */
type Geometry = {
	left: number;
	width: number;
	pinned: boolean;
	pinLeft: number;
};

export type ColumnWindow = { columnStart: number; columnEnd: number };
export type ColumnSlot =
	| { kind: "column"; index: number }
	| { kind: "spacer"; index: number; width: number };

/** 按实际冻结边界查找可见列，并在两侧保留一整列；小表/关闭虚拟化时保留所有列。 */
export function columnWindow(
	layout: readonly Geometry[],
	scrollLeft: number,
	viewportWidth: number,
	gutter: number,
	enabled: boolean,
): ColumnWindow {
	if (!enabled || viewportWidth <= 0)
		return { columnStart: 0, columnEnd: layout.length };
	const frozenEdge = layout.reduce(
		(edge, column) =>
			column.pinned ? Math.max(edge, column.pinLeft + column.width) : edge,
		gutter,
	);
	const left = Math.max(0, scrollLeft) + frozenEdge;
	const right = Math.max(0, scrollLeft) + viewportWidth;
	let first = -1;
	let last = -1;
	for (let index = 0; index < layout.length; index++) {
		const column = layout[index];
		if (
			column &&
			!column.pinned &&
			column.left + column.width > left &&
			column.left < right
		) {
			if (first < 0) first = index;
			last = index;
		}
	}
	return first < 0
		? { columnStart: 0, columnEnd: 0 }
		: {
				columnStart: Math.max(0, first - 1),
				columnEnd: Math.min(layout.length, last + 2),
			};
}

/** 合并连续屏幕外列为等宽占位；保留稳定的列索引和当前交互列，避免编辑器卸载。 */
export function columnRenderPlan(
	layout: readonly (Geometry & { column: { id: string } })[],
	window: ColumnWindow,
	activeColumn?: string,
	editingColumn?: string,
): ColumnSlot[] {
	const slots: ColumnSlot[] = [];
	for (let index = 0; index < layout.length; index++) {
		const column = layout[index];
		if (!column) continue;
		if (
			column.pinned ||
			(index >= window.columnStart && index < window.columnEnd) ||
			column.column.id === activeColumn ||
			column.column.id === editingColumn
		) {
			slots.push({ kind: "column", index });
		} else {
			const previous = slots.at(-1);
			if (previous?.kind === "spacer") previous.width += column.width;
			else slots.push({ kind: "spacer", index, width: column.width });
		}
	}
	return slots;
}
