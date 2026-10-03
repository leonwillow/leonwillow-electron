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
import { colorFormatter } from "../src/utils/theme/color-converter";
import { importThemeCss } from "../src/utils/theme/css-import";
import { parseCssInput } from "../src/utils/theme/parse-css-input";
import { getShadowMap } from "../src/utils/theme/shadows";
import { generateThemeCode } from "../src/utils/theme/theme-style-generator";

const css = await Bun.file(
	new URL("../../../packages/ui/src/styles/globals.css", import.meta.url),
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
	expect(removed.customThemes).toHaveLength(1);
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

test("官方转换器保留现代色值和透明度，低饱和度 HSL 不会误转成高饱和度", () => {
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
	expect(chroma(imported.styles.dark.border ?? "").alpha()).toBeCloseTo(0.1, 2);
	expect(output).not.toContain("undefined");
	expect(output).not.toContain("--spacing:");
	expect(imported.styles.light.destructive).toBe(
		draft.styles.light.destructive,
	);
	expect(Object.values(getShadowMap(styled.styles.light)).join()).not.toContain(
		"/ 1.75)",
	);
});
