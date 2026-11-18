/**
 * @file 当前用户的图谱工具栏布局偏好。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-18
 * 版本作用：在各案件间复用操作习惯，不保存案件资料。
 * 被调用：GraphCanvas；调用：useLocalStorageState、model/toolbar-layout。
 * 功能：读取、保存、跨窗口同步，存储失败保留本次设置并提示。
 * 预期结果：刷新和下钻不重置工具栏，用户之间隔离。
 */
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import {
	decodeToolbarLayout,
	type ToolbarLayout,
	toolbarLayoutStorageKey,
} from "./model/toolbar-layout";

export function useToolbarLayout(userId: string) {
	const {
		value: layout,
		save,
		error,
	} = useLocalStorageState<ToolbarLayout>({
		key: toolbarLayoutStorageKey(userId),
		decode: decodeToolbarLayout,
		encode: (next) => JSON.stringify({ version: 1, ...next }),
		saveErrorMessage: "工具栏设置暂未保存，刷新后可能丢失。",
	});
	return { layout, save, error };
}
