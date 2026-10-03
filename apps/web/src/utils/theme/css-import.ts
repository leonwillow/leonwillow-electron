// 官方 CSS 导入解析器的项目适配与校验边界。
import { FONT_CONFIG } from "@/configs/fonts";
import { RADIUS_VALUES } from "@/configs/theme-settings";
import { isStyleValue } from "@/lib/custom-themes";
import type { ThemeDraft, ThemeStyleProps } from "@/types/theme";
import {
	parseCssInput,
	parseShadowVariables,
} from "@/utils/theme/parse-css-input";
export function importThemeCss(input: string, draft: ThemeDraft): ThemeDraft {
	if (input.length > 100_000)
		throw new Error("CSS 内容过大，请只粘贴主题变量。");
	const { lightColors, darkColors } = parseCssInput(input);
	if (!Object.keys(lightColors).length && !Object.keys(darkColors).length)
		throw new Error("没有找到 :root 或 .dark 中支持的主题变量。");
	const next = {
		...draft,
		styles: {
			light: { ...draft.styles.light },
			dark: { ...draft.styles.dark },
		},
	};
	for (const [mode, values] of [
		["light", lightColors],
		["dark", darkColors],
	] as const) {
		for (const [key, value] of Object.entries(values)) {
			if (key === "radius" || key === "font-sans") continue;
			if (!isStyleValue(key, value))
				throw new Error(`无效的主题变量：--${key}`);
			next.styles[mode][key as keyof ThemeStyleProps] = value;
		}
	}
	if (/--shadow(?:-[a-z0-9]+)?:/.test(input)) {
		const { lightShadows, darkShadows } = parseShadowVariables(input);
		for (const [mode, values] of [
			["light", lightShadows],
			["dark", darkShadows],
		] as const) {
			// 只更新含阴影声明的模式，未导入的模式保持当前值。
			const block = input.match(
				mode === "light" ? /:root\s*{([^}]+)}/ : /\.dark\s*{([^}]+)}/,
			)?.[1];
			if (!block?.includes("--shadow")) continue;
			for (const [key, value] of Object.entries(values)) {
				if (!isStyleValue(key, value))
					throw new Error(`无效的阴影变量：--${key}`);
				next.styles[mode][key as keyof ThemeStyleProps] = value;
			}
		}
	}
	if (lightColors["letter-spacing"] && !darkColors["letter-spacing"])
		next.styles.dark["letter-spacing"] = lightColors["letter-spacing"];
	const font = lightColors["font-sans"];
	if (font) {
		const entry = Object.entries(FONT_CONFIG).find(
			([, config]) =>
				font === `var(${config.variable})` ||
				font.replace(/["']/g, "").split(",")[0]?.trim() === config.label,
		);
		if (entry) next.font = entry[0] as ThemeDraft["font"];
	}
	const radius = lightColors.radius;
	if (radius) {
		const entry = Object.entries(RADIUS_VALUES).find(
			([, value]) => value === radius,
		);
		if (entry) next.radius = entry[0] as ThemeDraft["radius"];
	}
	return next;
}
