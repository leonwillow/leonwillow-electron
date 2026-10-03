import { FONT_CONFIG } from "@/configs/fonts";
import { themePresets } from "@/configs/theme-presets";
import { initialSettings } from "@/configs/theme-settings";
import themeConfig from "@/configs/themeConfig";
import { decodeCustomThemes, isCustomThemeId } from "@/lib/custom-themes";
import type { Settings, ThemePreferences } from "@/types/theme";

// 读取持久化设置时逐项校验，旧版本或损坏的数据回退到原模板默认值。
export function normalizeSettings(value: unknown): Settings {
	if (!value || typeof value !== "object") return { ...initialSettings };
	const input = value as Record<string, unknown>;
	return {
		mode:
			input.mode === "light" || input.mode === "dark" || input.mode === "system"
				? input.mode
				: initialSettings.mode,
		themePreset:
			typeof input.themePreset === "string" &&
			(input.themePreset === "default" ||
				isCustomThemeId(input.themePreset) ||
				Object.hasOwn(themePresets, input.themePreset))
				? (input.themePreset as Settings["themePreset"])
				: initialSettings.themePreset,
		font:
			typeof input.font === "string" && Object.hasOwn(FONT_CONFIG, input.font)
				? (input.font as Settings["font"])
				: initialSettings.font,
		radius:
			input.radius === "none" ||
			input.radius === "sm" ||
			input.radius === "md" ||
			input.radius === "lg"
				? input.radius
				: initialSettings.radius,
		scale:
			input.scale === "sm" ||
			input.scale === "md" ||
			input.scale === "lg" ||
			input.scale === "xl"
				? input.scale
				: initialSettings.scale,
	};
}

// 旧三档设置中的“大”迁移为“特大”；新版本的“大”仍为 lg。
export function decodeStoredSettings(value: unknown): Settings {
	if (value && typeof value === "object") {
		const stored = value as Record<string, unknown>;
		if (stored.version !== 2 && stored.scale === "lg") {
			return normalizeSettings({ ...stored, scale: "xl" });
		}
	}
	return normalizeSettings(value);
}

export function encodeStoredSettings(settings: Settings) {
	return { ...settings, version: 2 } as const;
}

export function decodeThemePreferences(value: unknown): ThemePreferences {
	const settings = decodeStoredSettings(value);
	const customThemes = decodeCustomThemes(
		value && typeof value === "object"
			? (value as Record<string, unknown>).customThemes
			: null,
	);
	if (
		isCustomThemeId(settings.themePreset) &&
		!customThemes.some((theme) => theme.id === settings.themePreset)
	)
		settings.themePreset = "default";
	return { settings, customThemes };
}

export function encodeThemePreferences(preferences: ThemePreferences) {
	return {
		...encodeStoredSettings(preferences.settings),
		customThemes: preferences.customThemes,
	};
}

export function readThemePreferences(): ThemePreferences {
	try {
		return decodeThemePreferences(
			JSON.parse(
				localStorage.getItem(themeConfig.settingsStorageKey) ?? "null",
			),
		);
	} catch {
		return { settings: { ...initialSettings }, customThemes: [] };
	}
}

export const savedPreferences = readThemePreferences();
export const savedSettings = savedPreferences.settings;
