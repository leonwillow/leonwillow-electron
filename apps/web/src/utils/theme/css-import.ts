/**
 * @file CSS 输入进入主题草稿的校验边界。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test/custom-themes.test.ts、components/theme-editor/theme-control-panel.tsx。
 * 调用：configs/fonts、configs/theme-settings、lib/custom-themes、types/theme、utils/theme/parse-css-input。
 * 功能：限制输入长度，校验支持的变量并按模式合并。
 * 预期结果：合法内容形成新草稿，无效内容报错且不改变原草稿。
 */
import { FONT_CONFIG } from "@/configs/fonts";
import { RADIUS_VALUES } from "@/configs/theme-settings";
import { isStyleValue } from "@/lib/custom-themes";
import type { ThemeDraft, ThemeStyleProps } from "@/types/theme";
import {
	parseCssInput,
	parseShadowVariables,
} from "@/utils/theme/parse-css-input";
/**
 * 将支持的 CSS 变量合并到草稿，保留未出现的模式与字段。
 * @param input 最多 100,000 字符的 CSS；不执行、不插入 style 标签。
 * @param draft 当前草稿，不会原地修改；字体与圆角仅采用项目已支持的选项。
 * @returns 可预览的新草稿，保存仍由主题库操作完成。
 * @throws 内容过大、没有可识别变量或支持的变量值不合法。
 */
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
