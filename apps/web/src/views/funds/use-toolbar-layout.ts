/**
 * @file 当前用户的图谱工具栏布局偏好。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：在各案件间复用操作习惯，不保存案件资料。
 * 被调用：GraphCanvas；调用：funds-toolbar-layout、localStorage。
 * 功能：读取、保存、跨窗口同步，存储失败保留本次设置并提示。
 * 预期结果：刷新和下钻不重置工具栏，用户之间隔离。
 */
import { useEffect, useState } from "react";
import {
	decodeToolbarLayout,
	type ToolbarLayout,
	toolbarLayoutStorageKey,
} from "@/lib/funds-toolbar-layout";

export function useToolbarLayout(userId: string) {
	const key = toolbarLayoutStorageKey(userId);
	const [layout, setLayout] = useState(() => {
		try {
			return decodeToolbarLayout(localStorage.getItem(key));
		} catch {
			return decodeToolbarLayout(null);
		}
	});
	const [error, setError] = useState("");
	useEffect(() => {
		const sync = (event: StorageEvent) => {
			if (
				event.storageArea === localStorage &&
				(event.key === key || event.key === null)
			) {
				setLayout(decodeToolbarLayout(event.newValue));
				setError("");
			}
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [key]);
	const save = (next: ToolbarLayout) => {
		setLayout(next);
		try {
			localStorage.setItem(key, JSON.stringify({ version: 1, ...next }));
			setError("");
		} catch {
			setError("工具栏设置暂未保存，刷新后可能丢失。");
		}
	};
	return { layout, save, error };
}
