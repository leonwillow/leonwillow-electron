/**
 * @file 当前用户的画布速览窗口偏好。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：独立保存位置与折叠状态，不存账户或交易内容。
 * 被调用：GraphHoverPreview；调用：八处停靠目录、localStorage。
 * 预期结果：跨案与刷新复用布局，损坏存储回退，存储失败保留当前操作并提示。
 */
import { useEffect, useState } from "react";
import {
	type ToolbarPosition,
	toolbarPositions,
} from "@/lib/funds-toolbar-layout";

export type PreviewLayout = { position: ToolbarPosition; collapsed: boolean };
export const defaultPreviewLayout: PreviewLayout = {
	position: "top-right",
	collapsed: false,
};
export function decodePreviewLayout(raw: string | null): PreviewLayout {
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
	const key = `funds:preview:v1:${encodeURIComponent(userId)}`;
	const read = () => {
		try {
			return decodePreviewLayout(localStorage.getItem(key));
		} catch {
			return { ...defaultPreviewLayout };
		}
	};
	const [stored, setStored] = useState(() => ({ key, value: read() }));
	const [error, setError] = useState("");
	if (stored.key !== key) {
		setStored({ key, value: read() });
		setError("");
	}
	useEffect(() => {
		const sync = (event: StorageEvent) => {
			if (
				event.storageArea === localStorage &&
				(event.key === key || event.key === null)
			) {
				setStored({ key, value: decodePreviewLayout(event.newValue) });
				setError("");
			}
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [key]);
	return {
		layout: stored.value,
		error,
		save(value: PreviewLayout) {
			setStored({ key, value });
			try {
				localStorage.setItem(key, JSON.stringify({ version: 1, ...value }));
				setError("");
			} catch {
				setError("速览位置暂未保存，刷新后可能丢失。");
			}
		},
	};
}
