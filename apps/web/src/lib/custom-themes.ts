import chroma from "chroma-js";
import { FONT_CONFIG } from "@/configs/fonts";
import { themePresets } from "@/configs/theme-presets";
import { initialSettings } from "@/configs/theme-settings";
import { COLOR_KEYS, EDITABLE_STYLE_KEYS } from "@/configs/theme-variables";
import type {
	CustomTheme,
	CustomThemeId,
	ThemeDraft,
	ThemePreferences,
	ThemeStyleProps,
	ThemeStyles,
} from "@/types/theme";

export function isCustomThemeId(value: unknown): value is CustomThemeId {
	return typeof value === "string" && /^custom:[a-zA-Z0-9-]{1,64}$/.test(value);
}

// 调色、导入与持久化共用校验；只接受可解析的颜色值，禁止任意 CSS / 外部资源。
export function isColorValue(value: string) {
	return (
		value.length <= 120 &&
		/^(?:#[\da-f]{3,8}|(?:oklch|oklab|hsl|hsla|rgb|rgba|lab|lch)\([\d\s.,%/+\-e]+\)|[a-z]+)$/i.test(
			value.trim(),
		) &&
		chroma.valid(value.trim())
	);
}

export function isStyleValue(key: string, value: unknown): value is string {
	if (typeof value !== "string") return false;
	if ((COLOR_KEYS as readonly string[]).includes(key) || key === "shadow-color")
		return isColorValue(value);
	if (key === "shadow-opacity")
		return (
			/^\d*\.?\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 1
		);
	if (key === "letter-spacing")
		return (
			/^-?\d*\.?\d+em$/.test(value) &&
			Math.abs(Number.parseFloat(value)) <= 0.25
		);
	if (/^shadow-(blur|spread|offset-x|offset-y)$/.test(key)) {
		return (
			/^(?:-?\d*\.?\d+px|0)$/.test(value) &&
			Math.abs(Number.parseFloat(value)) <= 50 &&
			(key !== "shadow-blur" || Number.parseFloat(value) >= 0)
		);
	}
	return false;
}

export function sanitizeStyles(value: unknown): ThemeStyles | null {
	if (!value || typeof value !== "object") return null;
	const styles = value as Record<string, unknown>;
	const result: ThemeStyles = { light: {}, dark: {} };
	for (const mode of ["light", "dark"] as const) {
		if (!styles[mode] || typeof styles[mode] !== "object") return null;
		const values = styles[mode] as Record<string, unknown>;
		for (const key of EDITABLE_STYLE_KEYS) {
			if (Object.hasOwn(values, key)) {
				if (!isStyleValue(key, values[key])) return null;
				result[mode][key] = values[key].trim();
			}
		}
		if (!COLOR_KEYS.every((key) => result[mode][key])) return null;
	}
	return result;
}

export function decodeCustomThemes(value: unknown): CustomTheme[] {
	if (!Array.isArray(value)) return [];
	const result: CustomTheme[] = [];
	for (const entry of value.slice(0, 100)) {
		if (!entry || typeof entry !== "object" || !isCustomThemeId(entry.id))
			continue;
		if (
			typeof entry.label !== "string" ||
			!entry.label.trim() ||
			entry.label.trim().length > 40
		)
			continue;
		const styles = sanitizeStyles(entry.styles);
		if (
			!styles ||
			result.some(
				(theme) =>
					theme.id === entry.id ||
					theme.label.toLocaleLowerCase() ===
						entry.label.trim().toLocaleLowerCase(),
			)
		)
			continue;
		result.push({
			id: entry.id,
			label: entry.label.trim(),
			styles,
			font: Object.hasOwn(FONT_CONFIG, entry.font)
				? entry.font
				: initialSettings.font,
			radius: ["none", "sm", "md", "lg"].includes(entry.radius)
				? entry.radius
				: initialSettings.radius,
		});
	}
	return result;
}

// 迁移官方 HoldToSaveTheme 的名称校验与追加逻辑，ID 独立于可编辑名称。
export function saveCustomTheme(
	preferences: ThemePreferences,
	draft: ThemeDraft,
	id: CustomThemeId,
): ThemePreferences {
	const label = draft.label.trim();
	if (!label || label.length > 40)
		throw new Error("主题名称需为 1～40 个字符。");
	if (
		preferences.customThemes.some(
			(theme) =>
				theme.id !== id &&
				theme.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
		) ||
		label === "默认" ||
		Object.values(themePresets).some(
			(theme) => theme.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
		)
	)
		throw new Error("这个主题名称已存在，请换一个名称。");
	const styles = sanitizeStyles(draft.styles);
	if (!styles) throw new Error("主题中存在无效颜色或样式，请先修正。");
	const theme: CustomTheme = { ...draft, label, styles, id };
	const index = preferences.customThemes.findIndex((item) => item.id === id);
	if (index < 0 && preferences.customThemes.length >= 100)
		throw new Error("最多保存 100 个主题，请先删除不需要的主题。");
	return {
		settings: {
			...preferences.settings,
			themePreset: id,
			font: draft.font,
			radius: draft.radius,
		},
		customThemes:
			index < 0
				? [...preferences.customThemes, theme]
				: preferences.customThemes.map((item) =>
						item.id === id ? theme : item,
					),
	};
}

export function deleteCustomTheme(
	preferences: ThemePreferences,
	id: CustomThemeId,
): ThemePreferences {
	return {
		settings:
			preferences.settings.themePreset === id
				? { ...preferences.settings, themePreset: "default" }
				: preferences.settings,
		customThemes: preferences.customThemes.filter((theme) => theme.id !== id),
	};
}

export function getPreset(preferences: ThemePreferences) {
	const key = preferences.settings.themePreset;
	if (isCustomThemeId(key))
		return preferences.customThemes.find((theme) => theme.id === key);
	return key === "default" ? undefined : themePresets[key];
}

export function hasCustomShadow(styles: Partial<ThemeStyleProps>) {
	return Object.keys(styles).some((key) => key.startsWith("shadow-"));
}
