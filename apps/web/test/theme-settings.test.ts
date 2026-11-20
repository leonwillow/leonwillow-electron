/**
 * @file 主题偏好存储版本的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、主题预设与默认设置、主题编解码与 DOM 应用入口。
 * 功能：检查缩放迁移、线条偏好往返、损坏字段回退及模式切换的变量清理。
 * 预期结果：新版大档不会重复迁移为特大。
 */
import { expect, test } from "bun:test";
import chroma from "chroma-js";
import { themePresets } from "../src/configs/theme-presets";
import { initialSettings } from "../src/configs/theme-settings";
import { applyTheme } from "../src/lib/theme-script";
import {
	decodeStoredSettings,
	encodeStoredSettings,
	normalizeSettings,
} from "../src/lib/theme-settings";
import type { ThemePreferences } from "../src/types/theme";
import { parseCssInput } from "../src/utils/theme/parse-css-input";

const defaultTokensCss = await Bun.file(
	new URL("../../../packages/ui/src/styles/tokens.css", import.meta.url),
).text();
const defaultTokens = parseCssInput(defaultTokensCss);

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
	for (const sidebarMode of [
		"docked",
		"wide",
		"floating",
		"floating-pill",
	] as const) {
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
			themePreset: "vuexy",
			radius: "sm",
			scale: "lg",
			font: "inter",
			sidebarMode: "floating",
		}),
	).toEqual({
		...initialSettings,
		mode: "dark",
		themePreset: "vuexy",
		radius: "sm",
		scale: "lg",
		font: "inter",
		sidebarMode: "floating",
		borderWidth: 1,
		borderColorLight: null,
		borderColorDark: null,
	});
});

test("已下线的旧内置预设安全回退到默认，保留其他外观偏好", () => {
	for (const removed of [
		"caffeine",
		"ghibli-studio",
		"marvel",
		"pastel-dreams",
	]) {
		expect(
			decodeStoredSettings({
				version: 2,
				mode: "dark",
				themePreset: removed,
				sidebarMode: "floating-pill",
			}),
		).toMatchObject({
			mode: "dark",
			themePreset: "default",
			sidebarMode: "floating-pill",
		});
	}
});

test("默认主题与所有内置预设的正文、按钮、语义状态色与微底色对比度及 sRGB 色域全部达标", () => {
	const pairs: ReadonlyArray<[string, string, number]> = [
		["foreground", "background", 7],
		["card-foreground", "card", 7],
		["popover-foreground", "popover", 7],
		["sidebar-foreground", "sidebar", 7],
		["muted-foreground", "background", 4.5],
		["muted-foreground", "card", 4.5],
		["muted-foreground", "muted", 4.5],
		["primary-foreground", "primary", 4.5],
		["primary", "background", 4.5],
		["primary", "card", 4.5],
		["sidebar-primary", "sidebar", 4.5],
		["sidebar-primary-foreground", "sidebar-primary", 4.5],
		["secondary-foreground", "secondary", 4.5],
		["accent-foreground", "accent", 4.5],
		["sidebar-accent-foreground", "sidebar-accent", 4.5],
		["destructive", "background", 4.5],
		["destructive", "card", 4.5],
		["destructive-foreground", "card", 4.5],
		["info-foreground", "card", 4.5],
		["success-foreground", "card", 4.5],
		["warning-foreground", "card", 4.5],
	];
	const allThemes: Array<
		[
			string,
			{
				styles: { light: Record<string, string>; dark: Record<string, string> };
			},
		]
	> = [
		[
			"default",
			{
				styles: {
					light: defaultTokens.lightColors as Record<string, string>,
					dark: {
						...defaultTokens.lightColors,
						...defaultTokens.darkColors,
					} as Record<string, string>,
				},
			},
		],
		...Object.entries(themePresets).map(
			([id, preset]) =>
				[
					id,
					{
						styles: {
							light: preset.styles.light as Record<string, string>,
							dark: preset.styles.dark as Record<string, string>,
						},
					},
				] as [
					string,
					{
						styles: {
							light: Record<string, string>;
							dark: Record<string, string>;
						};
					},
				],
		),
	];
	for (const [id, preset] of allThemes) {
		for (const mode of ["light", "dark"] as const) {
			const styles = preset.styles[mode];
			for (const [key, value] of Object.entries(styles)) {
				if (key === "radius" || key === "font-sans") continue;
				expect(chroma(value).clipped(), `${id}.${mode}.${key} 越出 sRGB`).toBe(
					false,
				);
			}
			for (const [fg, bg, minContrast] of pairs) {
				expect(
					chroma.contrast(styles[fg] ?? "", styles[bg] ?? ""),
					`${id}.${mode}: ${fg} on ${bg}`,
				).toBeGreaterThanOrEqual(minContrast);
			}
			for (const [fgKey, tintKey, alpha, minContrast] of [
				["info-foreground", "info", 0.1, 4.5],
				["success-foreground", "success", 0.1, 4.5],
				["warning-foreground", "warning", 0.1, 4.5],
				[
					"destructive-foreground",
					"destructive",
					mode === "dark" ? 0.2 : 0.1,
					4.5,
				],
				["primary", "primary", 0.1, 4.2],
			] as const) {
				const surface = chroma
					.mix(styles.card ?? "", styles[tintKey] ?? "", alpha, "rgb")
					.hex();
				expect(
					chroma.contrast(styles[fgKey] ?? "", surface),
					`${id}.${mode}: ${fgKey} on ${tintKey}/${alpha * 100}%`,
				).toBeGreaterThanOrEqual(minContrast);
			}
		}
	}
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
				themePreset: "vuexy",
				borderWidth: 1.5,
				borderColorLight: "#cbd5e1",
				borderColorDark: null,
			},
			customThemes: [],
		};
		applyTheme(preferences, "light");
		expect(variables.get("--ui-border-width")).toBe("1.5px");
		expect(variables.get("--ui-line-color")).toBe("#cbd5e1");
		for (const key of [
			"border",
			"input",
			"sidebar-border",
			"info",
			"success",
			"warning",
		] as const)
			expect(variables.get(`--${key}`)).toBe(
				themePresets.vuexy.styles.light[key],
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
				styles: {
					light: {},
					dark: { border: "#445566", "shadow-blur": "12px" },
				},
			},
		);
		expect(variables.get("--ui-line-color")).toBe("#112233");
		expect(variables.get("--border")).toBe("#445566");
		expect(variables.get("--ui-shadow-md")).toContain("12px");

		applyTheme({ settings: { ...initialSettings }, customThemes: [] }, "light");
		expect(variables.get("--ui-border-width")).toBe("1px");
		expect(variables.has("--ui-line-color")).toBe(false);
		expect(variables.has("--ui-shadow-md")).toBe(false);
		expect(variables.has("--info")).toBe(false);
		expect(variables.has("--success")).toBe(false);
		expect(variables.has("--warning")).toBe(false);
	} finally {
		if (originalDocument)
			Object.defineProperty(globalThis, "document", originalDocument);
		else Reflect.deleteProperty(globalThis, "document");
	}
});
