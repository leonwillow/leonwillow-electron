/**
 * @file 背景存储边界与任意自定义色上的图元可读性回归。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：防止损坏存储或低对比度配色令画布不可用。
 * 被调用：bun test；调用：funds-canvas-background、chroma-js。
 * 预期结果：枚举/实色严格校验，原有可读颜色保留，不合格颜色有对比度兜底。
 */
import { expect, test } from "bun:test";
import chroma from "chroma-js";
import {
	canvasBackgroundStorageKey,
	canvasGraphPalette,
	canvasPatterns,
	canvasTones,
	decodeCanvasBackground,
	defaultCanvasBackground,
	opaqueCanvasColor,
} from "../src/lib/funds-canvas-background";

test("全部颜色纹理组合往返，账号存储隔离，只保留背景设置", () => {
	for (const [tone] of canvasTones)
		for (const [pattern] of canvasPatterns) {
			const value = { tone, pattern, customColor: "#123abc" };
			expect(
				decodeCanvasBackground(
					JSON.stringify({ version: 1, ...value, caseId: "discard" }),
				),
			).toEqual(value);
		}
	expect(canvasBackgroundStorageKey("a:b")).not.toBe(
		canvasBackgroundStorageKey("a%3Ab"),
	);
});

test("损坏版本、枚举、透明色及外部资源均回退默认", () => {
	for (const raw of [
		null,
		"invalid",
		"null",
		"[]",
		...[
			{ version: 2 },
			{ tone: "unknown" },
			{ pattern: "url(x)" },
			{ customColor: "url(https://example.com)" },
			{ customColor: "#ffffff00" },
			{ customColor: null },
		].map((invalid) =>
			JSON.stringify({ version: 1, ...defaultCanvasBackground, ...invalid }),
		),
	]) {
		expect(decodeCanvasBackground(raw)).toEqual(defaultCanvasBackground);
	}
	expect(opaqueCanvasColor("rgba(255, 0, 0, 0.2)")).toBe("#ff0000");
});

test("任意深浅和鲜艳背景上默认标签与图元保持对比度，可读主题色不变", () => {
	const original = {
		foreground: "#18181b",
		muted: "#71717a",
		primary: "#007a96",
	};
	for (const background of [
		"#ffffff",
		"#000000",
		"#777777",
		"#00ffff",
		"#ff0000",
		"#00ff00",
		"#242b38",
		"#fff5dc",
	]) {
		const palette = canvasGraphPalette({ ...original, background });
		expect(
			chroma.contrast(palette.foreground, background),
		).toBeGreaterThanOrEqual(4.5);
		expect(chroma.contrast(palette.muted, background)).toBeGreaterThanOrEqual(
			3,
		);
		expect(chroma.contrast(palette.primary, background)).toBeGreaterThanOrEqual(
			3,
		);
	}
	const palette = canvasGraphPalette({ ...original, background: "#ffffff" });
	expect(palette.foreground).toBe(original.foreground);
	expect(palette.primary).toBe(original.primary);
});
