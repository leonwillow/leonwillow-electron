/**
 * @file 主题偏好到根元素样式的应用边界。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：main.tsx、components/layout/theme-effects.tsx。
 * 调用：configs/fonts、configs/theme-settings、configs/theme-variables、lib/custom-themes、types/theme、utils/theme/shadows。
 * 功能：清理旧变量，再应用颜色、阴影、字体、圆角和缩放。
 * 预期结果：首屏、预览和跨窗口更新采用相同外观规则。
 */
import { FONT_CONFIG } from "@/configs/fonts";
import { RADIUS_VALUES } from "@/configs/theme-settings";
import { EDITABLE_STYLE_KEYS, SHADOW_VARS } from "@/configs/theme-variables";
import {
	getPreset,
	hasCustomShadow,
	isCustomThemeId,
} from "@/lib/custom-themes";
import type {
	ThemeDraft,
	ThemePreferences,
	ThemeStyleProps,
} from "@/types/theme";
import { getShadowMap } from "@/utils/theme/shadows";

/**
 * 先清除上一次的变量，再应用当前主题，避免不同预设的阴影和颜色互相残留。
 * @param preferences 已持久化的设置及主题库。
 * @param mode 已解析的浅色或深色模式。
 * @param preview 临时草稿；只覆盖外观，不写入存储或广播。
 * @returns 无返回值；更新 html 的 CSS 变量、字体和缩放属性。
 */
export function applyTheme(
	preferences: ThemePreferences,
	mode: "light" | "dark",
	preview?: ThemeDraft,
) {
	const root = document.documentElement;
	for (const key of [...EDITABLE_STYLE_KEYS, ...SHADOW_VARS, "spacing"])
		root.style.removeProperty(`--${key}`);
	const draft = preview ?? getPreset(preferences);
	const styles: Partial<ThemeStyleProps> | undefined = draft?.styles[mode];
	if (styles) {
		for (const [key, value] of Object.entries(styles)) {
			if (value !== undefined && key !== "radius" && key !== "spacing")
				root.style.setProperty(`--${key}`, value);
		}
		// 自定义主题使用可编辑的阴影参数；内置主题保留自身的阴影样式。
		if (
			(preview || isCustomThemeId(preferences.settings.themePreset)) &&
			hasCustomShadow(styles)
		) {
			for (const [key, value] of Object.entries(getShadowMap(styles)))
				root.style.setProperty(`--${key}`, value);
		}
	}
	const settings = preferences.settings;
	root.style.setProperty(
		"--radius",
		RADIUS_VALUES[preview?.radius ?? settings.radius],
	);
	const font = `var(${FONT_CONFIG[preview?.font ?? settings.font].variable})`;
	root.style.setProperty("--font-sans", font);
	root.style.fontFamily = font;
	root.style.letterSpacing =
		preview || isCustomThemeId(settings.themePreset)
			? (styles?.["letter-spacing"] ?? "")
			: "";
	root.setAttribute("data-theme-scale", settings.scale);
}

/**
 * 在 React 挂载前确定明暗并应用偏好，减少默认主题闪烁。
 * @param preferences 已解码的首屏快照；system 模式读取媒体查询。
 * @returns 无返回值；后续变化由 ThemeEffects 接管。
 */
export function initializeTheme(preferences: ThemePreferences) {
	const { settings } = preferences;
	const root = document.documentElement;
	const dark =
		settings.mode === "dark" ||
		(settings.mode === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	root.classList.toggle("dark", dark);
	root.style.colorScheme = dark ? "dark" : "light";
	applyTheme(preferences, dark ? "dark" : "light");
}
