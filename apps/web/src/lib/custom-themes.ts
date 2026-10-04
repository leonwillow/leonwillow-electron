/**
 * @file 自定义主题库的校验与变更规则。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test、contexts、utils、utils/theme、components/theme-editor、lib。
 * 调用：chroma-js、configs/fonts、configs/theme-presets、configs/theme-settings、configs/theme-variables、types/theme。
 * 功能：校验样式、名称和 ID，生成保存或删除后的完整快照。
 * 预期结果：库内容与当前选择保持一致；此层不访问 DOM 或存储。
 */
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

/**
 * 验证可独立解析的颜色，排除变量引用、拼接声明和外部资源。
 * @param value 用户输入或存储中的 CSS 色值。
 * @returns 语法白名单与 chroma 解析均通过时为 true。
 */
export function isColorValue(value: string) {
	return (
		value.length <= 120 &&
		/^(?:#[\da-f]{3,8}|(?:oklch|oklab|hsl|hsla|rgb|rgba|lab|lch)\([\d\s.,%/+\-e]+\)|[a-z]+)$/i.test(
			value.trim(),
		) &&
		chroma.valid(value.trim())
	);
}

/**
 * 按变量语义检查颜色、单位和取值范围。
 * @param key 主题变量名，不含 -- 前缀；未知键不接受。
 * @param value 未受信任的导入或存储值。
 * @returns 是否可写入主题草稿和持久化快照。
 */
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

/**
 * 仅复制允许编辑的变量，浅深色必须各自具备完整语义色。
 * @param value 未校验的样式对象；不会原地修改。
 * @returns 清理后的样式；缺少模式、颜色或存在无效值时返回 null。
 */
function sanitizeStyles(value: unknown): ThemeStyles | null {
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

/**
 * 从存储读取主题库，跳过损坏条目、重复 ID 和重复名称。
 * @param value 未校验的 JSON 值；最多检查前 100 个条目。
 * @returns 可用主题列表；字体与圆角不合法时回退到默认值。
 */
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

/**
 * 校验名称与样式后生成新快照；使用稳定 ID 区分覆盖和另存。
 * @param preferences 当前主题库和选择项，不会原地修改。
 * @param draft 待保存的浅深色样式、字体、圆角和名称。
 * @param id 已有 ID 表示覆盖，新 ID 表示追加；重命名不改变 ID。
 * @returns 同时更新主题库和当前选择的快照；尚未写入 localStorage。
 * @throws 名称冲突、样式无效或新增主题超过容量限制。
 */
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

/**
 * 移除指定主题，并在删除当前主题时回退到默认配色。
 * @param preferences 当前快照；保留字号缩放等其他偏好。
 * @param id 要移除的稳定 ID。
 * @returns 新快照；目标不存在时主题内容保持不变。
 */
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

/**
 * 解析当前选择的内置或自定义主题。
 * @param preferences 含设置与主题库的完整快照。
 * @returns 对应主题；默认主题或悬空 ID 返回 undefined，由共享 CSS 提供默认色。
 */
export function getPreset(preferences: ThemePreferences) {
	const key = preferences.settings.themePreset;
	if (isCustomThemeId(key))
		return preferences.customThemes.find((theme) => theme.id === key);
	return key === "default" ? undefined : themePresets[key];
}

export function hasCustomShadow(styles: Partial<ThemeStyleProps>) {
	return Object.keys(styles).some((key) => key.startsWith("shadow-"));
}
