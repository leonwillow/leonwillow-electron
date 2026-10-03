import { FONT_CONFIG } from "@/configs/fonts";
import { themePresets } from "@/configs/theme-presets";
import { RADIUS_VALUES } from "@/configs/theme-settings";
import type { Settings } from "@/types/theme";

// 迁移自 getThemeInitAttributes/getThemeInitScript，在 React 首次渲染前应用。
export function initializeTheme(settings: Settings) {
	const root = document.documentElement;
	const dark =
		settings.mode === "dark" ||
		(settings.mode === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	root.classList.toggle("dark", dark);
	root.style.colorScheme = dark ? "dark" : "light";
	if (settings.themePreset !== "default") {
		const preset = themePresets[settings.themePreset];
		Object.entries(preset.styles[dark ? "dark" : "light"]).forEach(
			([key, value]) => {
				if (value !== undefined && key !== "radius" && key !== "spacing")
					root.style.setProperty(`--${key}`, value);
			},
		);
	}
	root.style.setProperty("--radius", RADIUS_VALUES[settings.radius]);
	const font = `var(${FONT_CONFIG[settings.font].variable})`;
	root.style.setProperty("--font-sans", font);
	root.style.fontFamily = font;
	root.setAttribute("data-theme-scale", settings.scale);
}
