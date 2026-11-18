/**
 * @file 选区并集外框的几何回归。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：覆盖选区起点、行列强调、内凹拐角、孔洞与虚拟窗口外相邻行。
 * 被调用：Bun test；调用：selection-outline。
 * 预期结果：边框只出现在真实选区外周，虚拟窗口不影响选区形状。
 */
import { describe, expect, test } from "bun:test";
import { createGrid, selectionBounds } from "../src/core";
import {
	SelectionEdge,
	selectionAnchorCell,
	selectionColumns,
	selectionRowCells,
} from "../src/selection-outline";

describe("selection visual semantics", () => {
	test("emphasizes only rows and columns in the union, including coordinates outside the mounted window", () => {
		const ranges = [
			{ r0: 10, r1: 10, c0: 1, c1: 1 },
			{ r0: 12, r1: 150, c0: 3, c1: 4 },
		];
		expect(selectionColumns(ranges, 6)).toEqual([
			false,
			true,
			false,
			true,
			true,
			false,
		]);
		for (const [row, selected] of [
			[10, true],
			[11, false],
			[100, true],
			[151, false],
		] as const)
			expect(
				selectionRowCells(ranges, row, 6).some(
					(mask) => mask & SelectionEdge.selected,
				),
			).toBe(selected);
		expect(selectionColumns([], 3)).toEqual([false, false, false]);
	});

	test("keeps the reverse-drag anchor selected while marking only its original cell for a plain background", () => {
		const ranges = [
			{ r0: 0, r1: 2, c0: 0, c1: 2 },
			{ r0: 4, r1: 4, c0: 3, c1: 3 },
		];
		const rows = Array.from({ length: 5 }, (_, row) =>
			selectionRowCells(ranges, row, 4, { row: 2, column: 2 }),
		);
		expect(
			rows.flat().filter((mask) => mask & SelectionEdge.anchor),
		).toHaveLength(1);
		expect((rows[2]?.[2] ?? 0) & SelectionEdge.selected).toBe(
			SelectionEdge.selected,
		);
		for (const [row, cells] of rows.entries())
			expect(cells.map((mask) => mask & ~SelectionEdge.anchor)).toEqual([
				...selectionRowCells(ranges, row, 4),
			]);
		// 新追加的单格成为唯一活动起点；此前保留区域不继续留白。
		expect(
			(selectionRowCells(ranges, 2, 4, { row: 4, column: 3 })[2] ?? 0) &
				SelectionEdge.anchor,
		).toBe(0);
		expect(
			(selectionRowCells(ranges, 4, 4, { row: 4, column: 3 })[3] ?? 0) &
				SelectionEdge.anchor,
		).toBe(SelectionEdge.anchor);
	});

	test("single-cell selection retains its current background and an unselected coordinate cannot become an anchor", () => {
		const ranges = [{ r0: 1, r1: 1, c0: 2, c1: 2 }];
		expect(selectionRowCells(ranges, 1, 4)[2]).toBe(31);
		expect(selectionRowCells(ranges, 1, 4, { row: 0, column: 0 })[0]).toBe(0);
		expect(selectionColumns(ranges, 4)).toEqual([false, false, true, false]);
	});

	test("keeps the anchor identity through sorting and frozen-column order changes, and drops invalid active ranges", () => {
		const store = createGrid({
			rows: [
				{ id: "a", left: 10, middle: 11, right: 12 },
				{ id: "b", left: 20, middle: 21, right: 22 },
				{ id: "c", left: 30, middle: 31, right: 32 },
			],
			columns: [
				{
					id: "left",
					field: "left",
					header: "左",
					type: "number",
					pinned: true,
				},
				{ id: "middle", field: "middle", header: "中" },
				{ id: "right", field: "right", header: "右" },
			],
			getRowId: (row) => row.id,
		});
		const rowIndex = (id: string) =>
			store.getSnapshot().viewRows.findIndex((row) => row.id === id);
		store.select({ rowId: "c", columnId: "middle" });
		store.select({ rowId: "b", columnId: "right" }, false, true);
		store.select({ rowId: "a", columnId: "left" }, true);
		store.sort("left", false, "desc");
		expect(store.reorderVisibleColumns(["right", "middle"], false)).toBe(true);
		let snapshot = store.getSnapshot();
		expect(
			selectionAnchorCell(snapshot.state.selection, rowIndex, snapshot.columns),
		).toEqual({ row: 1, column: 1 });
		store.setColumn("right", { hidden: true });
		snapshot = store.getSnapshot();
		expect(
			selectionAnchorCell(snapshot.state.selection, rowIndex, snapshot.columns),
		).toBeUndefined();
		let bounds = selectionBounds(
			snapshot.state,
			snapshot.viewRows,
			snapshot.columns,
			(row) => row.id,
		);
		expect(selectionColumns(bounds, snapshot.columns.length)).toEqual([
			false,
			true,
		]);
		expect(
			selectionAnchorCell(null, rowIndex, snapshot.columns),
		).toBeUndefined();
		store.setColumn("right", { hidden: false });
		store.setState({ search: "22" });
		snapshot = store.getSnapshot();
		expect(
			selectionAnchorCell(snapshot.state.selection, rowIndex, snapshot.columns),
		).toBeUndefined();
		bounds = selectionBounds(
			snapshot.state,
			snapshot.viewRows,
			snapshot.columns,
			(row) => row.id,
		);
		expect(bounds).toEqual([]);
	});
});

describe("selection outline", () => {
	test("draws a rectangle perimeter and keeps its interior border-free", () => {
		const ranges = [{ r0: 1, r1: 3, c0: 1, c1: 3 }];
		expect(selectionRowCells(ranges, 1, 5)).toEqual([0, 25, 17, 19, 0]);
		expect(selectionRowCells(ranges, 2, 5)).toEqual([0, 24, 16, 18, 0]);
		expect(selectionRowCells(ranges, 3, 5)).toEqual([0, 28, 20, 22, 0]);
	});
	test("preserves separate cells and merges overlapping selections", () => {
		expect(
			selectionRowCells(
				[
					{ r0: 0, r1: 0, c0: 0, c1: 0 },
					{ r0: 0, r1: 0, c0: 2, c1: 2 },
				],
				0,
				4,
			),
		).toEqual([31, 0, 31, 0]);
		expect(
			selectionRowCells(
				[
					{ r0: 0, r1: 1, c0: 0, c1: 1 },
					{ r0: 1, r1: 2, c0: 1, c1: 2 },
				],
				1,
				4,
			),
		).toEqual([
			28,
			SelectionEdge.selected |
				SelectionEdge.concaveTopRight |
				SelectionEdge.concaveBottomLeft,
			19,
			0,
		]);
	});
	test("fills all four inward corners in the selected cell and removes the patch when the diagonal joins", () => {
		const corners = [
			{ dr: -1, dc: -1, bit: SelectionEdge.concaveTopLeft, edges: 6 },
			{ dr: -1, dc: 1, bit: SelectionEdge.concaveTopRight, edges: 12 },
			{ dr: 1, dc: 1, bit: SelectionEdge.concaveBottomRight, edges: 9 },
			{ dr: 1, dc: -1, bit: SelectionEdge.concaveBottomLeft, edges: 3 },
		];
		for (const { dr, dc, bit, edges } of corners) {
			// 第 99/101 行可以尚未挂载；补角判断使用真实数据坐标。
			const ranges = [
				{ r0: 100, r1: 100, c0: 1, c1: 1 },
				{ r0: 100 + dr, r1: 100 + dr, c0: 1, c1: 1 },
				{ r0: 100, r1: 100, c0: 1 + dc, c1: 1 + dc },
			];
			expect(selectionRowCells(ranges, 100, 3)[1]).toBe(
				SelectionEdge.selected | edges | bit,
			);
			expect(
				selectionRowCells(
					[...ranges, { r0: 100 + dr, r1: 100 + dr, c0: 1 + dc, c1: 1 + dc }],
					100,
					3,
				)[1],
			).toBe(SelectionEdge.selected | edges);
		}
	});
	test("closes the four corners around a hole while leaving the hole unselected", () => {
		const ranges = [
			{ r0: 0, r1: 0, c0: 0, c1: 2 },
			{ r0: 2, r1: 2, c0: 0, c1: 2 },
			{ r0: 1, r1: 1, c0: 0, c1: 0 },
			{ r0: 1, r1: 1, c0: 2, c1: 2 },
		];
		expect(selectionRowCells(ranges, 0, 3)).toEqual([
			25 | SelectionEdge.concaveBottomRight,
			21,
			19 | SelectionEdge.concaveBottomLeft,
		]);
		expect(selectionRowCells(ranges, 1, 3)).toEqual([26, 0, 26]);
		expect(selectionRowCells(ranges, 2, 3)).toEqual([
			28 | SelectionEdge.concaveTopRight,
			21,
			22 | SelectionEdge.concaveTopLeft,
		]);
	});
	test("does not join cells that only touch diagonally or paint an unselected corner", () => {
		const ranges = [
			{ r0: 0, r1: 0, c0: 0, c1: 0 },
			{ r0: 1, r1: 1, c0: 1, c1: 1 },
		];
		expect(selectionRowCells(ranges, 0, 3)).toEqual([31, 0, 0]);
		expect(selectionRowCells(ranges, 1, 3)).toEqual([0, 31, 0]);
		expect(
			selectionRowCells(
				[
					{ r0: 0, r1: 0, c0: 1, c1: 1 },
					{ r0: 1, r1: 1, c0: 0, c1: 0 },
				],
				1,
				3,
			)[1],
		).toBe(0);
	});
	test("does not draw edges at a virtual window boundary or between adjacent ranges", () => {
		const ranges = [
			{ r0: 50, r1: 150, c0: 0, c1: 1 },
			{ r0: 50, r1: 150, c0: 2, c1: 3 },
		];
		expect(selectionRowCells(ranges, 100, 4)).toEqual([24, 16, 16, 18]);
		expect(selectionRowCells(ranges, 200, 4)).toEqual([0, 0, 0, 0]);
		expect(selectionRowCells([], 0, 0)).toEqual([]);
	});
});
