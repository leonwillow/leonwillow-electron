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

// 原模板的清理与应用顺序，在首次渲染、刷新、跨窗口更新和编辑预览中共用。
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
		// 内置主题沿用原模板行为；自定义主题的阴影参数转为 Tailwind 的阴影令牌。
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

// 迁移自 getThemeInitAttributes/getThemeInitScript，在 React 首次渲染前应用。
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
