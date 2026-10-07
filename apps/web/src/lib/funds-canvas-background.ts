/**
 * @file 画布背景偏好与图元对比度规则。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：只保存配色和纹理，不包含案件数据或镜头。
 * 被调用：背景设置、偏好 Hook、GraphRenderer 和测试。
 * 预期结果：非法存储回退；自定义深浅背景均有可读的默认图元，个人标记保持原样。
 */
import chroma from "chroma-js";

export const canvasTones = [
	["theme", "跟随主题"],
	["paper", "暖纸"],
	["blue", "雾蓝"],
	["sage", "浅绿"],
	["custom", "自定义"],
] as const;
export const canvasPatterns = [
	["none", "无纹理"],
	["dots", "点阵"],
	["grid", "网格"],
	["cross", "十字"],
] as const;
export type CanvasBackground = {
	tone: (typeof canvasTones)[number][0];
	pattern: (typeof canvasPatterns)[number][0];
	customColor: string;
};
export const defaultCanvasBackground: CanvasBackground = {
	tone: "theme",
	pattern: "none",
	customColor: "#ffffff",
};
export const canvasBackgroundStorageKey = (userId: string) =>
	`funds:canvas-background:v1:${encodeURIComponent(userId)}`;

/** 仅接受版本、枚举和不透明 HEX 色；未知协议、损坏或非法内容均回到默认。 */
export function decodeCanvasBackground(raw: string | null): CanvasBackground {
	try {
		const value = JSON.parse(raw ?? "null");
		if (
			value?.version === 1 &&
			canvasTones.some(([tone]) => tone === value.tone) &&
			canvasPatterns.some(([pattern]) => pattern === value.pattern) &&
			typeof value.customColor === "string" &&
			/^#[\da-f]{6}$/i.test(value.customColor)
		)
			return {
				tone: value.tone,
				pattern: value.pattern,
				customColor: value.customColor.toLowerCase(),
			};
	} catch {
		/* 本地偏好损坏不阻断图谱。 */
	}
	return { ...defaultCanvasBackground };
}

/** 颜色编辑器已校验的颜色转为不透明 HEX；不传入 CSS 变量或外部图片。 */
export const opaqueCanvasColor = (color: string) =>
	chroma(color).alpha(1).hex();

/** 在给定实色上选择对比度更高的黑/白墨色，用于纹理与默认图元兜底。 */
export const canvasInk = (color: string) =>
	chroma.contrast(color, "#000000") >= chroma.contrast(color, "#ffffff")
		? "dark"
		: "light";

/** 只校正不足对比度的默认样式；返回 G6 可解析的实色，不变更布局或用户标记。 */
export function canvasGraphPalette(colors: {
	background: string;
	foreground: string;
	muted: string;
	primary: string;
}) {
	const background = opaqueCanvasColor(colors.background);
	const ink = canvasInk(background) === "dark" ? "#000000" : "#ffffff";
	const readable = (value: string, ratio: number) =>
		chroma.contrast(value, background) >= ratio ? value : ink;
	return {
		background,
		foreground: readable(colors.foreground, 4.5),
		muted: readable(colors.muted, 3),
		primary: readable(colors.primary, 3),
	};
}
