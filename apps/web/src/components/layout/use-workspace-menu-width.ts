/**
 * @file 工作台单个二级菜单框的共享宽度状态与跨窗口同步。
 * 创建时间：2026-11-04；修改时间：2026-11-18。
 * 版本作用：只在拖拽提交后保存 rem 偏好，复用通用 useLocalStorageState。
 * 被调用：use-workspace-menu；调用：useLocalStorageState、workspace-menu-width。
 * 预期结果：模块切换保持宽度，存储失败不阻断拖拽，窗口同步不产生重复写入。
 */
import { useCallback } from "react";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import {
	decodeWorkspaceMenuWidth,
	isWorkspaceMenuWidth,
	workspaceMenuWidthStorageKey,
} from "@/lib/workspace-menu-width";

/** 用户工作台 Provider 按 userId 隔离生命周期；null 表示使用共享样式默认值。 */
export function useWorkspaceMenuWidth(userId: string) {
	const { value: widthRem, save } = useLocalStorageState<number | null>({
		key: workspaceMenuWidthStorageKey(userId),
		decode: decodeWorkspaceMenuWidth,
		encode: (value) => JSON.stringify(value),
	});
	const setWidthRem = useCallback(
		(value: number) => {
			if (!isWorkspaceMenuWidth(value)) return;
			save(value);
		},
		[save],
	);
	return { widthRem, setWidthRem };
}
