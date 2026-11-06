/**
 * @file 快速滚动和大跨度跳转的虚拟窗口覆盖回归。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 调用：无 DOM 范围计算；预期：每次跳转都覆盖视口、边界有界且缓冲内不反复通知。
 */
import { expect, test } from "bun:test";
import { virtualRange } from "../src/virtual-range";

test("89行保持完整渲染；大表跳转始终覆盖全部可视行", () => {
	expect(virtualRange(89, 32, 2000, 640, { start: 0, end: 25 })).toEqual({
		start: 0,
		end: 89,
	});
	let range = { start: 0, end: 25 };
	for (const top of [0, 32000, 650, 36000, 9000, 0]) {
		range = virtualRange(1200, 32, top, 640, range);
		expect(range.start).toBeLessThanOrEqual(Math.floor(top / 32));
		expect(range.end).toBeGreaterThanOrEqual(Math.ceil((top + 640) / 32));
		expect(range.end - range.start).toBeLessThanOrEqual(70);
	}
});

test("缓冲内复用窗口，缩减数据后不会留下越界虚拟行", () => {
	const range = virtualRange(1200, 32, 5000, 640, { start: 0, end: 25 });
	expect(virtualRange(1200, 32, 5032, 640, range)).toBe(range);
	expect(virtualRange(0, 32, 5032, 640, range)).toEqual({ start: 0, end: 0 });
	expect(virtualRange(300, 32, 0, 640, range, 8, false)).toEqual({
		start: 0,
		end: 300,
	});
});
