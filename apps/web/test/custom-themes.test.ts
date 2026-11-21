/**
 * @file 主题库与 CSS 往返的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、chroma-js、../src/configs/theme-settings、../src/lib/custom-themes、../src/lib/theme-settings、../src/types/theme、../src/utils/theme/color-converter、../src/utils/theme/css-import、../src/utils/theme/parse-css-input、../src/utils/theme/shadows、../src/utils/theme/theme-style-generator。
 * 功能：检查保存/删除、损坏数据、颜色透明度及导入导出。
 * 预期结果：主题选择与库保持一致，合法样式在转换后保留含义。
 */
import { expect, test } from "bun:test";
import chroma from "chroma-js";
import { initialSettings } from "../src/configs/theme-settings";
import {
	decodeCustomThemes,
	deleteCustomTheme,
	isColorValue,
	saveCustomTheme,
} from "../src/lib/custom-themes";
import {
	decodeThemePreferences,
	encodeThemePreferences,
} from "../src/lib/theme-settings";
import type { ThemeDraft } from "../src/types/theme";
import {
	colorFormatter,
	resolveSilkColor,
} from "../src/utils/theme/color-converter";
import { importThemeCss } from "../src/utils/theme/css-import";
import {
	parseCssInput,
	parseShadowVariables,
} from "../src/utils/theme/parse-css-input";
import { getShadowMap } from "../src/utils/theme/shadows";
import { generateThemeCode } from "../src/utils/theme/theme-style-generator";

const css = await Bun.file(
	new URL("../../../packages/ui/src/styles/tokens.css", import.meta.url),
).text();
const { lightColors, darkColors } = parseCssInput(css);
const draft: ThemeDraft = {
	label: "测试主题",
	font: "inter",
	radius: "lg",
	styles: { light: lightColors, dark: { ...lightColors, ...darkColors } },
};
const empty = {
	settings: { ...initialSettings, scale: "lg" as const },
	customThemes: [],
};

test("自定义主题保存、改名和另存时维持稳定 ID，删除当前主题回退默认且保留缩放", () => {
	const first = saveCustomTheme(empty, draft, "custom:first");
	expect(first.settings).toMatchObject({
		themePreset: "custom:first",
		scale: "lg",
		font: "inter",
		radius: "lg",
	});
	const renamed = saveCustomTheme(
		first,
		{
			...draft,
			label: "改名后",
			styles: {
				...draft.styles,
				light: { ...draft.styles.light, primary: "#6750a4" },
			},
		},
		"custom:first",
	);
	expect(renamed.customThemes).toHaveLength(1);
	expect(renamed.customThemes[0]).toMatchObject({
		id: "custom:first",
		label: "改名后",
		styles: { light: { primary: "#6750a4" } },
	});
	const copy = saveCustomTheme(
		renamed,
		{ ...draft, label: "副本" },
		"custom:copy",
	);
	expect(copy.customThemes).toHaveLength(2);
	expect(() =>
		saveCustomTheme(copy, { ...draft, label: "副本" }, "custom:other"),
	).toThrow("名称已存在");
	const removed = deleteCustomTheme(copy, "custom:copy");
	expect(removed.settings.themePreset).toBe("default");
	expect(removed.settings.scale).toBe("lg");
	expect(removed.customThemes).toHaveLength(2);
	expect(
		removed.customThemes.find((theme) => theme.id === "custom:copy")?.deletedAt,
	).toBeString();
	expect(decodeCustomThemes(removed.customThemes)).toEqual(
		removed.customThemes,
	);
});

test("一个快照同时恢复主题库和当前选择，四档缩放遵循已有 version 2 编解码", () => {
	for (const scale of ["sm", "md", "lg", "xl"] as const) {
		const saved = saveCustomTheme(
			{ ...empty, settings: { ...empty.settings, scale } },
			draft,
			"custom:saved",
		);
		expect(
			decodeThemePreferences(
				JSON.parse(JSON.stringify(encodeThemePreferences(saved))),
			),
		).toEqual(saved);
	}
	expect(
		decodeThemePreferences({ ...initialSettings, scale: "lg" }).settings.scale,
	).toBe("xl");
	expect(
		decodeThemePreferences({
			...initialSettings,
			themePreset: "custom:missing",
			version: 2,
		}).settings.themePreset,
	).toBe("default");
});

test("损坏主题和任意 CSS 值不能进入已保存的主题库", () => {
	const saved = saveCustomTheme(empty, draft, "custom:valid").customThemes[0];
	if (!saved) throw new Error("测试主题未保存。");
	expect(
		decodeCustomThemes([
			saved,
			{
				...saved,
				id: "custom:bad",
				styles: {
					...draft.styles,
					light: {
						...draft.styles.light,
						primary: "url(https://example.com/image)",
					},
				},
			},
		]),
	).toEqual([saved]);
	expect(isColorValue("var(--primary)")).toBe(false);
	expect(isColorValue("red; background: url(x)")).toBe(false);
	expect(isColorValue("oklch(0.75 0.12 160 / 35%)")).toBe(true);
	expect(() =>
		saveCustomTheme(empty, { ...draft, label: " " }, "custom:new"),
	).toThrow("名称");
});

test("颜色转换保留现代色值和透明度，低饱和度 HSL 不会误转成高饱和度", () => {
	const hex = colorFormatter("hsl(230 1% 90%)", "hex");
	expect(chroma(hex).hsl()[1]).toBeLessThan(0.02);
	for (const format of ["hex", "rgb", "hsl", "oklch"] as const) {
		const value = colorFormatter("oklch(1 0 0 / 10%)", format);
		expect(chroma(value).alpha()).toBeCloseTo(0.1, 2);
		expect(value).not.toContain("NaN");
	}
	expect(colorFormatter("rgba(10, 20, 30, 0.5)", "hex")).toBe("#0a141e80");
	const original = "oklch(0.577 0.245 27.325 / 12.5%)";
	expect(colorFormatter(original, "oklch")).toBe(original);
	expect(
		chroma(colorFormatter("rgb(10 20 30 / 0.125)", "oklch")).alpha(),
	).toBeCloseTo(0.125, 5);
});

test("阴影简写中的不透明度按百分号区分比例与百分比", () => {
	for (const [input, expected] of [
		["1", "1"],
		["0", "0"],
		["0.5", "0.5"],
		["50%", "0.5"],
		["12.5%", "0.125"],
	]) {
		const { lightShadows } = parseShadowVariables(
			`:root { --shadow-xs: 0px 1px 2px 0px hsl(0 0% 0% / ${input}); }`,
		);
		expect(lightShadows["shadow-opacity"]).toBe(expected);
	}
});

test("CSS 按模式合并，拒绝无效值，不能导入第二套间距/缩放/字号", () => {
	const imported = importThemeCss(
		":root { --primary: #6750a4; --spacing: 1rem; --text-sm: 90px; } .dark { --primary: rgb(180 160 220 / 50%); }",
		draft,
	);
	expect(imported.styles.light.primary).toBe("#6750a4");
	expect(imported.styles.dark.primary).toBe("rgb(180 160 220 / 50%)");
	expect(imported.styles.light.background).toBe(draft.styles.light.background);
	expect(imported.styles.light.spacing).toBeUndefined();
	expect(() => importThemeCss(":root { --primary: url(x); }", draft)).toThrow(
		"无效",
	);
	expect(() => importThemeCss(".foo { color: red; }", draft)).toThrow(
		"没有找到",
	);
});

test("CSS 导出可重新导入颜色、透明度、阴影参数及项目字体/圆角", () => {
	const styled = {
		...draft,
		styles: {
			...draft.styles,
			light: {
				...draft.styles.light,
				"primary-hover": "#685dd8",
				"destructive-solid-foreground": "#ffffff",
				"shadow-color": "#000000",
				"shadow-opacity": "0.7",
				"shadow-blur": "8px",
				"shadow-spread": "2px",
				"shadow-offset-x": "0",
				"shadow-offset-y": "3px",
			},
		},
	};
	const output = generateThemeCode(
		{
			...styled.styles,
			light: {
				...styled.styles.light,
				radius: "0.875rem",
				"font-sans": "var(--font-inter)",
			},
		},
		"oklch",
	);
	const imported = importThemeCss(output, draft);
	expect(imported.font).toBe("inter");
	expect(imported.radius).toBe("lg");
	expect(imported.styles.light["shadow-blur"]).toBe("8px");
	expect(imported.styles.light["shadow-opacity"]).toBe("0.7");
	expect(chroma(imported.styles.light["primary-hover"] ?? "").hex()).toBe(
		"#685dd8",
	);
	expect(
		chroma(imported.styles.light["destructive-solid-foreground"] ?? "").hex(),
	).toBe("#ffffff");
	expect(chroma(imported.styles.dark.border ?? "").alpha()).toBeCloseTo(0.1, 2);
	expect(output).not.toContain("undefined");
	expect(output).not.toContain("--spacing:");
	expect(imported.styles.light.destructive).toBe(
		draft.styles.light.destructive,
	);
	expect(Object.values(getShadowMap(styled.styles.light)).join()).not.toContain(
		"/ 1.75)",
	);
	const hexShadows = getShadowMap(
		{
			"shadow-color": "#000000",
			"shadow-opacity": "0.2",
			"shadow-blur": "4px",
		},
		"hex",
	);
	expect(hexShadows["shadow-sm"]).toContain("#00000033");
	expect(hexShadows["shadow-2xs"]).toContain("#0000001a");
	expect(hexShadows["shadow-2xl"]).toContain("16px 24px");
});

test("标记删除主题不占名称，历史超过百条仍保留且不能被旧选择重新激活", () => {
	const saved = saveCustomTheme(empty, draft, "custom:first");
	const removed = deleteCustomTheme(saved, "custom:first");
	const copy = saveCustomTheme(removed, draft, "custom:second");
	const deletedTheme = removed.customThemes[0];
	if (!deletedTheme) throw new Error("缺少主题");
	const tombstones = Array.from({ length: 110 }, (_, i) => ({
		...deletedTheme,
		id: `custom:old-${i}` as const,
	}));
	const decoded = decodeThemePreferences(
		encodeThemePreferences({
			...copy,
			customThemes: [...tombstones, ...copy.customThemes],
			settings: { ...copy.settings, themePreset: "custom:first" },
		}),
	);
	expect(decoded.customThemes).toHaveLength(112);
	expect(decoded.settings.themePreset).toBe("default");
	expect(() => saveCustomTheme(removed, draft, "custom:first")).toThrow(
		"该主题已删除",
	);
});

test("线性 CSS 解析器面对超长畸形变量输入不触发正则回溯", () => {
	const pathological = `:root { ${"--".repeat(60_000)} --primary: #6750a4; }`;
	const start = performance.now();
	const { lightColors } = parseCssInput(pathological);
	expect(performance.now() - start).toBeLessThan(200);
	expect(lightColors.primary).toBeUndefined();
});

test("忽略注释内的示例变量块并合并多块 :root/.dark，同时支持 rgba/hsla 阴影解析", () => {
	const cssWithComments = `
	/* 示例：:root { --primary: #000000; --shadow-xs: 0px 4px 12px 0px hsl(0 0% 0% / 0.9); } */
	:root { --primary: #2563eb; }
	:root { --shadow-xs: 0px 2px 6px 0px rgba(10, 20, 30, 0.25); }
	.dark { --primary: #60a5fa; --shadow-xs: 0px 3px 8px 0px hsla(210, 50%, 40%, 0.4); }
	`;
	const imported = importThemeCss(cssWithComments, draft);
	expect(imported.styles.light.primary).toBe("#2563eb");
	expect(imported.styles.dark.primary).toBe("#60a5fa");
	expect(imported.styles.light["shadow-blur"]).toBe("6px");
	expect(imported.styles.light["shadow-opacity"]).toBe("0.25");
	expect(imported.styles.light["shadow-color"]).toBe("#0a141e");
	expect(imported.styles.dark["shadow-blur"]).toBe("8px");
	expect(imported.styles.dark["shadow-opacity"]).toBe("0.4");
});

test("deleteCustomTheme 自动保留最近 50 条删除墓碑以控制本地存储增长", () => {
	const saved = saveCustomTheme(empty, draft, "custom:current");
	const sample = saved.customThemes[0];
	if (!sample) throw new Error("缺少主题");
	const existingDeleted = Array.from({ length: 55 }, (_, i) => ({
		...sample,
		id: `custom:old-${i}` as const,
		label: `旧主题-${i}`,
		deletedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
	}));
	const removed = deleteCustomTheme(
		{
			...saved,
			customThemes: [...existingDeleted, ...saved.customThemes],
		},
		"custom:current",
	);
	expect(removed.customThemes).toHaveLength(50);
	expect(
		removed.customThemes.some((theme) => theme.id === "custom:current"),
	).toBe(true);
	expect(
		removed.customThemes.some((theme) => theme.id === "custom:old-0"),
	).toBe(false);
});

test("resolveSilkColor 对默认中性主色回退品牌蓝并在深色模式下限制过亮眩光", () => {
	expect(resolveSilkColor("#171717", false)).toBe("#2563eb");
	expect(resolveSilkColor("#e5e5e5", true)).toBe("#1e3a6e");
	const brightDarkSilk = resolveSilkColor("#fef08a", true);
	expect(chroma(brightDarkSilk).oklch()[0]).toBeLessThanOrEqual(0.51);
});
