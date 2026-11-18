/**
 * @file 当前用户的画布速览窗口偏好。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-18
 * 版本作用：独立保存位置与折叠状态，不存账户或交易内容。
 * 被调用：GraphHoverPreview；调用：useLocalStorageState、八处停靠目录。
 * 预期结果：跨案与刷新复用布局，损坏存储回退，存储失败保留当前操作并提示。
 */
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { type ToolbarPosition, toolbarPositions } from "./model/toolbar-layout";

export type PreviewLayout = { position: ToolbarPosition; collapsed: boolean };
export const defaultPreviewLayout: PreviewLayout = {
	position: "top-right",
	collapsed: false,
};

function decodePreviewLayout(raw: string | null): PreviewLayout {
	try {
		const value = JSON.parse(raw ?? "null");
		if (
			value?.version === 1 &&
			typeof value.collapsed === "boolean" &&
			toolbarPositions.some(([p]) => p === value.position)
		)
			return { position: value.position, collapsed: value.collapsed };
	} catch {
		/* 损坏的本地偏好只影响布局，使用默认值继续显示。 */
	}
	return { ...defaultPreviewLayout };
}

export function usePreviewLayout(userId: string) {
	const {
		value: layout,
		save,
		error,
	} = useLocalStorageState<PreviewLayout>({
		key: `funds:preview:v1:${encodeURIComponent(userId)}`,
		decode: decodePreviewLayout,
		encode: (value) => JSON.stringify({ version: 1, ...value }),
		saveErrorMessage: "速览位置暂未保存，刷新后可能丢失。",
	});
	return { layout, save, error };
}
