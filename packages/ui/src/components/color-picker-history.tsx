/**
 * @file 色盘最近颜色的去重与持久化数据校验。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：提取 ReUI c-color-picker-9 的最近八色逻辑，加入等价色去重与损坏数据回退。
 * 被调用：ThemeLineSettings、色盘回归测试；调用：color-picker-color。
 * 预期结果：仅记录有效颜色，保留透明度，最新选择置前且最多八项。
 */
import { formatColor, parseColor } from "./color-picker-color";

/** 接受未知存储值，仅返回规范化的有效最近颜色；无效项逐项忽略。 */
export function normalizeRecentColors(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const colors: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const color = parseColor(entry);
		if (!color) continue;
		const hex = formatColor(color, "hex");
		if (!colors.includes(hex)) colors.push(hex);
		if (colors.length === 8) break;
	}
	return colors;
}

/** 在一次完整选择后记录颜色；无效值或清除不会污染已有历史。 */
export function addRecentColor(
	colors: readonly string[],
	value: string | null,
) {
	return normalizeRecentColors([value, ...colors]);
}

/** 解码浏览器保存的历史；缺失、损坏或非数组数据返回空列表。 */
export function parseRecentColors(serialized: string | null): string[] {
	if (!serialized) return [];
	try {
		return normalizeRecentColors(JSON.parse(serialized));
	} catch {
		return [];
	}
}
