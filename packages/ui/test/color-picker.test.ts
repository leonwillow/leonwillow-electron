/**
 * @file ReUI 色盘的颜色与最近记录回归测试。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：验证主题透明度、OKLCH 色域和损坏历史的边界。
 * 被调用：test:ui；调用：color-picker-color、color-picker-history。
 * 预期结果：调色不会丢失透明度，无效值不进入最近记录。
 */
import { describe, expect, test } from "bun:test";
import {
	formatColor,
	getContrastRatio,
	isColorInSrgb,
	parseColor,
	withChannel,
} from "../src/components/color-picker-color";
import {
	addRecentColor,
	normalizeRecentColors,
	parseRecentColors,
} from "../src/components/color-picker-history";

describe("color picker color boundaries", () => {
	test("reads theme OKLCH and preserves its alpha while changing hue", () => {
		const color = parseColor("oklch(0.922 0 0 / 20%)");
		expect(color).not.toBeNull();
		if (!color) throw new Error("theme color should parse");
		expect(color.alpha).toBe(0.2);
		const changed = withChannel(color, "hsv", "hue", 240);
		expect(changed.alpha).toBe(0.2);
		expect(parseColor(formatColor(changed, "hex"))?.alpha).toBeCloseTo(0.2, 4);
	});

	test("keeps transparent and eight-digit HEX values transparent", () => {
		for (const input of ["transparent", "#0000", "#33669900"]) {
			const color = parseColor(input);
			if (!color) throw new Error("transparent color should parse");
			expect(color.alpha).toBe(0);
			expect(parseColor(formatColor(color, "hex"))?.alpha).toBe(0);
		}
		expect(parseColor("#12345680")?.alpha).toBeCloseTo(128 / 255, 8);
	});

	test("retains wide-gamut OKLCH channels instead of clipping the stored color", () => {
		const color = parseColor("oklch(70% 0.4 30 / 0.5)");
		if (!color) throw new Error("OKLCH should parse");
		expect(isColorInSrgb(color)).toBe(false);
		expect(formatColor(color, "oklch")).toBe("oklch(70% 0.4 30 / 0.5)");
	});

	test("rejects incomplete, non-finite and unresolved CSS values", () => {
		for (const input of [
			"#ff",
			"rgb(12 34)",
			"oklch(1e999 0 0)",
			"rgb(1 2 3 / nope)",
			"var(--border)",
			"currentColor",
		]) {
			expect(parseColor(input)).toBeNull();
		}
	});

	test("keeps exact HEX colors through the editable OKLCH format", () => {
		for (const input of ["#00ff00", "#ff0022", "#808080", "#7c3aed"]) {
			const color = parseColor(input);
			if (!color) throw new Error("HEX should parse");
			const roundTrip = parseColor(formatColor(color, "oklch"));
			if (!roundTrip) throw new Error("OKLCH should parse");
			expect(formatColor(roundTrip, "hex")).toBe(input);
		}
	});

	test("contrast calculation composites translucent foregrounds", () => {
		expect(getContrastRatio("#000", "#fff")).toBe(21);
		expect(getContrastRatio("#0000", "#fff")).toBe(1);
	});
});

describe("recent color history", () => {
	test("dedupes equivalent formats while retaining distinct opacity", () => {
		expect(
			normalizeRecentColors(["#FFF", "rgb(255 255 255)", "#ffffff80"]),
		).toEqual(["#ffffff", "#ffffff80"]);
	});

	test("moves the latest pick first and caps history at eight colors", () => {
		const colors = Array.from(
			{ length: 10 },
			(_, index) => `#${String(index).repeat(6)}`,
		);
		expect(addRecentColor(colors, "#333333")).toEqual([
			"#333333",
			"#000000",
			"#111111",
			"#222222",
			"#444444",
			"#555555",
			"#666666",
			"#777777",
		]);
	});

	test("recovers corrupted storage and ignores invalid entries", () => {
		expect(parseRecentColors("{broken")).toEqual([]);
		expect(parseRecentColors('{"color":"#fff"}')).toEqual([]);
		expect(parseRecentColors('[null, "oops", "#3456", 12]')).toEqual([
			"#33445566",
		]);
		expect(addRecentColor(["#33445566"], null)).toEqual(["#33445566"]);
	});
});
