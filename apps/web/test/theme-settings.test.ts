/**
 * @file 主题偏好存储版本的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-19
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、主题预设与默认设置、主题编解码与 DOM 应用入口。
 * 功能：检查缩放迁移、线条偏好往返、损坏字段回退及模式切换的变量清理。
 * 预期结果：新版大档不会重复迁移为特大。
 */
import { expect, test } from "bun:test";
import { themePresets } from "../src/configs/theme-presets";
import { initialSettings } from "../src/configs/theme-settings";
import { applyTheme } from "../src/lib/theme-script";
import {
	decodeStoredSettings,
	encodeStoredSettings,
	normalizeSettings,
} from "../src/lib/theme-settings";
import type { ThemePreferences } from "../src/types/theme";

test("旧版大档迁移为特大，保留其他偏好", () => {
	expect(
		decodeStoredSettings({
			...initialSettings,
			scale: "lg",
			font: "inter",
			radius: "lg",
		}),
	).toEqual({ ...initialSettings, scale: "xl", font: "inter", radius: "lg" });
});

test("新四档可以独立保存和恢复，大档不会被再次迁移", () => {
	for (const scale of ["sm", "md", "lg", "xl"] as const) {
		const settings = { ...initialSettings, scale };
		expect(
			decodeStoredSettings(
				JSON.parse(JSON.stringify(encodeStoredSettings(settings))),
			),
		).toEqual(settings);
		expect(normalizeSettings(settings).scale).toBe(scale);
	}
});

test("损坏和过期设置回退到有效默认值", () => {
	expect(decodeStoredSettings(null)).toEqual(initialSettings);
	expect(decodeStoredSettings({ scale: "unknown", font: "missing" })).toEqual(
		initialSettings,
	);
});

test("旧快照与无效菜单模式继续贴边，有效悬浮偏好往返后保留其他外观", () => {
	const legacy = { version: 2, mode: "dark", scale: "lg", font: "inter" };
	expect(decodeStoredSettings(legacy)).toMatchObject({
		mode: "dark",
		scale: "lg",
		font: "inter",
		sidebarMode: "docked",
	});
	for (const sidebarMode of [undefined, true, "overlay", null]) {
		expect(decodeStoredSettings({ ...legacy, sidebarMode }).sidebarMode).toBe(
			"docked",
		);
	}
	for (const sidebarMode of ["docked", "floating", "floating-pill"] as const) {
		const settings = { ...initialSettings, sidebarMode, radius: "lg" as const };
		expect(
			decodeStoredSettings(
				JSON.parse(JSON.stringify(encodeStoredSettings(settings))),
			),
		).toEqual(settings);
	}
});

test("旧快照补齐默认线宽和跟随主题的浅深色，不改变已有外观偏好", () => {
	expect(
		decodeStoredSettings({
			version: 2,
			mode: "dark",
			themePreset: "caffeine",
			radius: "sm",
			scale: "lg",
			font: "inter",
			sidebarMode: "floating",
		}),
	).toEqual({
		...initialSettings,
		mode: "dark",
		themePreset: "caffeine",
		radius: "sm",
		scale: "lg",
		font: "inter",
		sidebarMode: "floating",
		borderWidth: 1,
		borderColorLight: null,
		borderColorDark: null,
	});
});

test("四种线宽与各自的浅深色覆盖独立往返，空值保留跟随主题语义", () => {
	for (const borderWidth of [0.5, 1, 1.5, 2] as const) {
		for (const [borderColorLight, borderColorDark] of [
			[null, null],
			["#cbd5e1", null],
			[null, "oklch(0.75 0.12 160 / 35%)"],
			["rgb(120 100 80 / 50%)", "#f0f0f0"],
		]) {
			const settings = {
				...initialSettings,
				borderWidth,
				borderColorLight: borderColorLight ?? null,
				borderColorDark: borderColorDark ?? null,
			};
			expect(
				decodeStoredSettings(
					JSON.parse(JSON.stringify(encodeStoredSettings(settings))),
				),
			).toEqual(settings);
		}
	}
});

test("非法线宽与不可解析的颜色逐项回退，不接受变量、声明或外部资源", () => {
	for (const borderWidth of [
		undefined,
		null,
		0,
		-1,
		0.75,
		3,
		"0.5",
		Number.NaN,
	]) {
		expect(normalizeSettings({ borderWidth }).borderWidth).toBe(1);
	}
	for (const color of [
		undefined,
		42,
		true,
		"",
		"inherit",
		"var(--border)",
		"red; background: url(x)",
		"url(https://example.com/color)",
	]) {
		const settings = normalizeSettings({
			borderWidth: 1.5,
			borderColorLight: color,
			borderColorDark: color,
		});
		expect(settings).toMatchObject({
			borderWidth: 1.5,
			borderColorLight: null,
			borderColorDark: null,
		});
	}
	expect(
		normalizeSettings({
			borderColorLight: "  #cbd5e1  ",
			borderColorDark: "var(--border)",
		}),
	).toMatchObject({ borderColorLight: "#cbd5e1", borderColorDark: null });
});

test("DOM 按模式应用线条覆盖而不替换主题语义色，跟随主题和重置会清理旧值", () => {
	const originalDocument = Object.getOwnPropertyDescriptor(
		globalThis,
		"document",
	);
	const variables = new Map<string, string>();
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			documentElement: {
				style: {
					setProperty: (key: string, value: string) =>
						variables.set(key, value),
					removeProperty: (key: string) => variables.delete(key),
				},
				setAttribute: () => {},
			},
		},
	});
	try {
		const preferences: ThemePreferences = {
			settings: {
				...initialSettings,
				themePreset: "caffeine",
				borderWidth: 1.5,
				borderColorLight: "#cbd5e1",
				borderColorDark: null,
			},
			customThemes: [],
		};
		applyTheme(preferences, "light");
		expect(variables.get("--ui-border-width")).toBe("1.5px");
		expect(variables.get("--ui-line-color")).toBe("#cbd5e1");
		for (const key of ["border", "input", "sidebar-border"] as const)
			expect(variables.get(`--${key}`)).toBe(
				themePresets.caffeine.styles.light[key],
			);

		applyTheme(preferences, "dark");
		expect(variables.has("--ui-line-color")).toBe(false);
		expect(variables.get("--ui-border-width")).toBe("1.5px");
		applyTheme(
			{
				...preferences,
				settings: { ...preferences.settings, borderColorDark: "#112233" },
			},
			"dark",
			{
				label: "临时预览",
				font: "inter",
				radius: "lg",
				styles: { light: {}, dark: { border: "#445566" } },
			},
		);
		expect(variables.get("--ui-line-color")).toBe("#112233");
		expect(variables.get("--border")).toBe("#445566");

		applyTheme({ settings: { ...initialSettings }, customThemes: [] }, "light");
		expect(variables.get("--ui-border-width")).toBe("1px");
		expect(variables.has("--ui-line-color")).toBe(false);
	} finally {
		if (originalDocument)
			Object.defineProperty(globalThis, "document", originalDocument);
		else Reflect.deleteProperty(globalThis, "document");
	}
});
