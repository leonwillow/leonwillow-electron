/**
 * @file 选区并集外框的几何回归。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：覆盖矩形、离散区域、重叠与窗口外相邻行，避免内部描边和虚假边界。
 * 被调用：Bun test；调用：selection-outline。
 * 预期结果：边框只出现在真实选区外周，虚拟窗口不影响选区形状。
 */
import { describe, expect, test } from "bun:test";
import { selectionRowCells } from "../src/selection-outline";

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
		).toEqual([28, 16, 19, 0]);
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
