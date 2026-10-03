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
