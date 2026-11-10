/**
 * @file 横向渲染窗口的覆盖、交互保留和占位几何回归。
 * 创建时间：2026-11-08；修改时间：2026-11-08。
 * 被调用：bun test；调用：columnWindow、columnRenderPlan 和真实 GridView。
 * 预期结果：任意滚动位置不漏可见/冻结列，占位总宽度不变，键盘和编辑列不被卸载。
 */
import { expect, it } from "bun:test";
import { columnRenderPlan, columnWindow } from "../src/column-window";
import { createGrid } from "../src/core";
import { GridView } from "../src/view-controller";

function geometry(widths: number[], pinnedCount: number) {
	let left = 48;
	return widths.map((width, index) => {
		const column = {
			column: { id: `c${index}` },
			left,
			width,
			pinLeft: left,
			pinned: index < pinnedCount,
		};
		left += width;
		return column;
	});
}

it("不同宽度、冻结数量和滚动位置始终覆盖可见列并保持列坐标", () => {
	const widths = Array.from({ length: 30 }, (_, i) => 64 + ((i * 43) % 220));
	for (const pinnedCount of [0, 1, 3]) {
		const layout = geometry(widths, pinnedCount);
		for (const viewport of [390, 940, 1500]) {
			const edge = 48 + widths.slice(0, pinnedCount).reduce((a, b) => a + b, 0);
			for (let scroll = 0; scroll < 4000; scroll += 73) {
				const window = columnWindow(layout, scroll, viewport, 48, true);
				const plan = columnRenderPlan(layout, window);
				const rendered = new Set(
					plan
						.filter((slot) => slot.kind === "column")
						.map((slot) => slot.index),
				);
				let left = 48;
				for (const slot of plan) {
					if (slot.kind === "column") {
						const column = layout[slot.index];
						if (!column) throw new Error("渲染计划引用了不存在的列");
						expect(left).toBe(column.left);
						left += column.width;
					} else left += slot.width;
				}
				expect(left).toBe(48 + widths.reduce((a, b) => a + b, 0));
				layout.forEach((column, index) => {
					if (
						column.pinned ||
						(column.left + column.width > scroll + edge &&
							column.left < scroll + viewport)
					)
						expect(rendered.has(index)).toBe(true);
				});
			}
		}
	}
});

it("保留屏幕外的编辑列和活动列，缓冲列先于进入视口挂载", () => {
	const layout = geometry(Array(20).fill(100), 2);
	const window = columnWindow(layout, 600, 648, 48, true);
	const plan = columnRenderPlan(layout, window, "c18", "c19");
	const visible = plan
		.filter((slot) => slot.kind === "column")
		.map((slot) => slot.index);
	expect(visible).toEqual([0, 1, 7, 8, 9, 10, 11, 12, 18, 19]);
	expect(plan.some((slot) => slot.kind === "spacer")).toBe(true);
	const all = columnRenderPlan(
		layout,
		columnWindow(layout, 600, 648, 48, false),
	);
	expect(all).toHaveLength(20);
	expect(all.every((slot) => slot.kind === "column")).toBe(true);
	expect(columnWindow([], 0, 0, 48, true)).toEqual({
		columnStart: 0,
		columnEnd: 0,
	});
});

it("纯横向滚动更新正文窗口，宽度/列结构改变重算，200行以内仍全部渲染", () => {
	const rows = Array.from({ length: 1200 }, (_, id) => ({ id: String(id) }));
	const columns = Array.from({ length: 20 }, (_, id) => ({
		id: `c${id}`,
		header: `列${id}`,
		width: 100,
		pinned: id < 2,
	}));
	const options = { rows, columns, getRowId: (row: { id: string }) => row.id };
	const store = createGrid(options);
	const view = new GridView(store, { id: "columns" });
	const viewport = {
		scrollTop: 0,
		scrollLeft: 0,
		clientWidth: 648,
		clientHeight: 600,
	};
	view.scroller = viewport as HTMLElement;
	const cleanup = view.mount();
	try {
		view.measure();
		const before = view.getSnapshot();
		viewport.scrollLeft = 610;
		view.onScroll();
		const after = view.getSnapshot();
		expect(after.start).toBe(before.start);
		expect(after.end).toBe(before.end);
		expect(after.columnStart).toBeGreaterThan(before.columnStart);
		expect(after.columnEnd).toBeGreaterThan(before.columnEnd);
		viewport.scrollLeft += 1;
		view.onScroll();
		expect(view.getSnapshot()).toBe(after);
		viewport.clientWidth = 390;
		view.measure();
		expect(view.getSnapshot().width).toBe(390);
		expect(view.layout().filter((column) => column.pinned)).toHaveLength(2);
		store.setColumn("c0", { width: 300 });
		expect(
			view
				.layout()
				.some((column) => column.column.id === "c0" && column.pinned),
		).toBe(false);
		store.updateOptions({ ...options, rows: rows.slice(0, 89) });
		expect(view.getSnapshot().columnStart).toBe(0);
		expect(view.getSnapshot().columnEnd).toBe(20);
		store.updateOptions(options);
		view.update({ id: "columns", virtualize: false });
		view.measure();
		expect(view.getSnapshot().columnStart).toBe(0);
		expect(view.getSnapshot().columnEnd).toBe(20);
	} finally {
		cleanup();
	}
});
