/**
 * @file 已选主题到编辑草稿的转换。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/theme-editor/theme-control-panel.tsx。
 * 调用：ui 基础组件/样式、lib/custom-themes、types/theme、utils/theme/parse-css-input。
 * 功能：从共享 CSS 补齐缺省语义色，再叠加选中预设。
 * 预期结果：编辑草稿拥有独立对象，不会修改内置预设。
 */
import globals from "@leonwillow-electron/ui/globals.css?raw";
import { getPreset, isCustomThemeId } from "@/lib/custom-themes";
import type { ThemeDraft, ThemePreferences } from "@/types/theme";
import { parseCssInput } from "@/utils/theme/parse-css-input";

// 读取同一份共享 CSS 默认值，避免另建一套默认色板。
const { lightColors, darkColors } = parseCssInput(globals);
const defaults = {
	light: lightColors,
	dark: { ...lightColors, ...darkColors },
};

/**
 * 以共享 CSS 默认值补齐所选预设，生成独立的编辑草稿。
 * @param preferences 当前选择、字体、圆角和自定义主题库。
 * @returns 可修改的浅深色对象；不会改变原预设或持久化快照。
 */
export function createThemeDraft(preferences: ThemePreferences): ThemeDraft {
	const preset = getPreset(preferences);
	return {
		label: isCustomThemeId(preferences.settings.themePreset)
			? (preset?.label ?? "我的主题")
			: "我的主题",
		styles: {
			light: { ...defaults.light, ...preset?.styles.light },
			dark: { ...defaults.dark, ...preset?.styles.dark },
		},
		font: preferences.settings.font,
		radius: preferences.settings.radius,
	};
}
