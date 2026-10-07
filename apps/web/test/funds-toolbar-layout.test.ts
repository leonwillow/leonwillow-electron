/**
 * @file 工具栏停靠规则与用户偏好回归。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：验证用户指定的方向约束和存储容错，不镜像 CSS。
 * 被调用：bun test；调用：funds-toolbar-layout。
 * 预期结果：八处停靠合法，四角可自由排列，边中强制方向，损坏偏好不致失控。
 */
import { expect, test } from "bun:test";
import {
	decodeToolbarLayout,
	defaultToolbarLayout,
	toolbarLayoutStorageKey,
	toolbarOrientation,
	toolbarPlacement,
	toolbarPositions,
} from "../src/lib/funds-toolbar-layout";

test("八个停靠位置：四角支持两种方向，边中限制正确", () => {
	expect(new Set(toolbarPositions.map(([position]) => position)).size).toBe(8);
	for (const [position] of toolbarPositions) {
		for (const orientation of ["horizontal", "vertical"] as const) {
			const layout = { position, orientation, collapsed: true };
			const expected = position.startsWith("middle")
				? "vertical"
				: position.endsWith("center")
					? "horizontal"
					: orientation;
			expect(toolbarOrientation(layout)).toBe(expected);
		}
	}
});

test("四角向停靠边收缩，边中向中点收缩，浮层朝画布内侧", () => {
	for (const position of [
		"top-left",
		"top-right",
		"bottom-left",
		"bottom-right",
	] as const) {
		const vertical = toolbarPlacement({
			position,
			orientation: "vertical",
			collapsed: false,
		});
		expect(vertical.fold).toBe(position.startsWith("top") ? "up" : "down");
		expect(vertical.side).toBe(position.endsWith("right") ? "left" : "right");
		const horizontal = toolbarPlacement({
			position,
			orientation: "horizontal",
			collapsed: false,
		});
		expect(horizontal.fold).toBe(position.endsWith("left") ? "left" : "right");
		expect(horizontal.side).toBe(position.startsWith("top") ? "bottom" : "top");
	}
	for (const position of [
		"middle-left",
		"middle-right",
		"top-center",
		"bottom-center",
	] as const) {
		expect(toolbarPlacement({ ...defaultToolbarLayout, position }).fold).toBe(
			"center",
		);
	}
});

test("偏好完整往返，边中保留角落的方向习惯但实际方向受限", () => {
	const layout = {
		position: "middle-right",
		orientation: "horizontal",
		collapsed: true,
	} as const;
	const decoded = decodeToolbarLayout(
		JSON.stringify({ version: 1, ...layout, ignored: "extra" }),
	);
	expect(decoded).toEqual(layout);
	expect(toolbarOrientation(decoded)).toBe("vertical");
	expect(toolbarOrientation({ ...decoded, position: "top-right" })).toBe(
		"horizontal",
	);
	expect(toolbarLayoutStorageKey("user/a")).not.toBe(
		toolbarLayoutStorageKey("user/b"),
	);
});

test("损坏、未知版本及非法字段回退默认，不传播不可信布局", () => {
	for (const raw of [
		null,
		"{",
		"null",
		"[]",
		"1",
		JSON.stringify({ version: 2, ...defaultToolbarLayout }),
		JSON.stringify({
			version: 1,
			...defaultToolbarLayout,
			position: "center-center",
		}),
		JSON.stringify({
			version: 1,
			...defaultToolbarLayout,
			orientation: "diagonal",
		}),
		JSON.stringify({ version: 1, ...defaultToolbarLayout, collapsed: "true" }),
	])
		expect(decodeToolbarLayout(raw)).toEqual(defaultToolbarLayout);
});
