/**
 * @file 图谱工具栏停靠、方向与个人偏好协议。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：为设置、DOM 停靠和回归测试提供同一套位置规则。
 * 被调用：GraphCanvas、GraphToolbarSettings、graph-toolbar-dock。
 * 功能：八处停靠、边中方向约束、折叠锚点及版本化解析。
 * 预期结果：损坏存储回退默认，工具栏偏好不影响案件事实或图谱镜头。
 */
export const toolbarPositions = [
	["top-left", "左上"],
	["top-center", "上中"],
	["top-right", "右上"],
	["middle-left", "左中"],
	["middle-right", "右中"],
	["bottom-left", "左下"],
	["bottom-center", "下中"],
	["bottom-right", "右下"],
] as const;
export type ToolbarPosition = (typeof toolbarPositions)[number][0];
export type ToolbarOrientation = "horizontal" | "vertical";
export type ToolbarLayout = {
	position: ToolbarPosition;
	orientation: ToolbarOrientation;
	collapsed: boolean;
};
export const defaultToolbarLayout: ToolbarLayout = {
	position: "bottom-left",
	orientation: "horizontal",
	collapsed: false,
};

export function toolbarOrientation(layout: ToolbarLayout): ToolbarOrientation {
	if (layout.position.startsWith("middle")) return "vertical";
	if (layout.position.endsWith("center")) return "horizontal";
	return layout.orientation;
}

/** 锚点确定收缩方向：角落向停靠边，边中向中点收拢。 */
export function toolbarPlacement(layout: ToolbarLayout) {
	const [y, x] = layout.position.split("-");
	const vertical = toolbarOrientation(layout) === "vertical";
	const fold = vertical
		? y === "top"
			? "up"
			: y === "bottom"
				? "down"
				: "center"
		: x === "left"
			? "left"
			: x === "right"
				? "right"
				: "center";
	const side = vertical
		? x === "right"
			? "left"
			: "right"
		: y === "top"
			? "bottom"
			: "top";
	return { x, y, fold, side, vertical } as const;
}

export function toolbarLayoutStorageKey(userId: string) {
	return `funds:toolbar:v1:${encodeURIComponent(userId)}`;
}

/** 仅接受当前版本及已知枚举；错误或未来版本均回退，不信任浏览器存储。 */
export function decodeToolbarLayout(raw: string | null): ToolbarLayout {
	try {
		const value = JSON.parse(raw ?? "null");
		if (
			value?.version !== 1 ||
			!toolbarPositions.some(([position]) => position === value.position) ||
			!["horizontal", "vertical"].includes(value.orientation) ||
			typeof value.collapsed !== "boolean"
		)
			return { ...defaultToolbarLayout };
		return {
			position: value.position,
			orientation: value.orientation,
			collapsed: value.collapsed,
		};
	} catch {
		return { ...defaultToolbarLayout };
	}
}
