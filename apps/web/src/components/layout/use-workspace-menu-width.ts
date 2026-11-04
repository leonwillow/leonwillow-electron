/**
 * @file 工作台单个二级菜单框的共享宽度状态与跨窗口同步。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：只在拖拽提交后保存 rem 偏好，不为各业务菜单创建独立宽度。
 * 被调用：use-workspace-menu；调用：React、workspace-menu-width、浏览器 storage 事件。
 * 预期结果：模块切换保持宽度，存储失败不阻断拖拽，窗口同步不产生重复写入。
 */
import { useCallback, useEffect, useState } from "react";
import {
	isWorkspaceMenuWidth,
	readWorkspaceMenuWidth,
	workspaceMenuWidthStorageKey,
	writeWorkspaceMenuWidth,
} from "@/lib/workspace-menu-width";

/** 用户工作台 Provider 按 userId 隔离生命周期；null 表示使用共享样式默认值。 */
export function useWorkspaceMenuWidth(userId: string) {
	const [widthRem, updateWidthRem] = useState(() =>
		readWorkspaceMenuWidth(userId),
	);
	const setWidthRem = useCallback(
		(value: number) => {
			if (!isWorkspaceMenuWidth(value)) return;
			updateWidthRem(value);
			writeWorkspaceMenuWidth(userId, value);
		},
		[userId],
	);
	useEffect(() => {
		const storageKey = workspaceMenuWidthStorageKey(userId);
		const sync = (event: StorageEvent) => {
			if (event.key === storageKey || event.key === null)
				updateWidthRem(readWorkspaceMenuWidth(userId));
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [userId]);
	return { widthRem, setWidthRem };
}
