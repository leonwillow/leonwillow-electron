/**
 * @file 主题持久化快照的编解码边界。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：持久化快照 v2，兼容旧三档缩放。
 * 被调用：apps/web/test/theme-settings.test.ts、apps/web/test/custom-themes.test.ts、stores/theme-store.ts。
 * 调用：configs/fonts、configs/theme-presets、configs/theme-settings、lib/custom-themes、types/theme。
 * 功能：逐项校验偏好，兼容旧缩放版本并修复悬空主题引用。
 * 预期结果：首屏和跨窗口同步获得相同规则处理后的偏好。
 */
import { FONT_CONFIG } from "@/configs/fonts";
import { themePresets } from "@/configs/theme-presets";
import { initialSettings, THEME_STORAGE_KEY } from "@/configs/theme-settings";
import { decodeCustomThemes, isCustomThemeId } from "@/lib/custom-themes";
import type { Settings, ThemePreferences } from "@/types/theme";

/**
 * 逐项恢复有效偏好，丢弃不认识的字段。
 * @param value 未校验对象；此步骤不处理存储版本或自定义主题引用。
 * @returns 字段完整的 Settings，无效字段各自回退默认值。
 */
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
		sidebarMode:
			input.sidebarMode === "docked" || input.sidebarMode === "floating"
				? input.sidebarMode
				: initialSettings.sidebarMode,
	};
}

/**
 * 读取存储设置并兼容旧三档缩放。
 * @param value 存储对象；version=2 的 lg 是当前大档，旧版 lg 对应 xl。
 * @returns 不含持久化版本字段的界面设置。
 */
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

/**
 * 原子恢复主题库和当前选择，防止选择项指向被过滤的主题。
 * @param value localStorage 或跨窗口消息的未校验快照。
 * @returns 校验后的偏好；悬空自定义 ID 回退 default。
 */
export function decodeThemePreferences(value: unknown): ThemePreferences {
	const settings = decodeStoredSettings(value);
	const customThemes = decodeCustomThemes(
		value && typeof value === "object"
			? (value as Record<string, unknown>).customThemes
			: null,
	);
	if (
		isCustomThemeId(settings.themePreset) &&
		!customThemes.some(
			(theme) => !theme.deletedAt && theme.id === settings.themePreset,
		)
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

/**
 * 读取并解码本地主题；存储被禁用或 JSON 损坏时使用默认设置。
 * @returns 可用于首屏渲染的完整偏好，不向存储写入回退值。
 */
export function readThemePreferences(): ThemePreferences {
	try {
		return decodeThemePreferences(
			JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "null"),
		);
	} catch {
		return { settings: { ...initialSettings }, customThemes: [] };
	}
}
