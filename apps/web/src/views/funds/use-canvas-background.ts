/**
 * @file 当前用户跨案件复用的画布背景设置。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：localStorage 保存和跨窗口同步；不请求 API。
 * 被调用：GraphCanvas；调用：funds-canvas-background。
 * 预期结果：账号隔离、刷新恢复；保存失败仍保留本次设置并提示。
 */
import { useEffect, useState } from "react";
import {
	type CanvasBackground,
	canvasBackgroundStorageKey,
	decodeCanvasBackground,
} from "@/lib/funds-canvas-background";

export function useCanvasBackground(userId: string) {
	const key = canvasBackgroundStorageKey(userId);
	const read = () => {
		try {
			return decodeCanvasBackground(localStorage.getItem(key));
		} catch {
			return decodeCanvasBackground(null);
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
				setStored({ key, value: decodeCanvasBackground(event.newValue) });
				setError("");
			}
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [key]);
	return {
		background: stored.value,
		error,
		save(value: CanvasBackground) {
			setStored({ key, value });
			try {
				localStorage.setItem(key, JSON.stringify({ version: 1, ...value }));
				setError("");
			} catch {
				setError("画布背景暂未保存，刷新后可能丢失。");
			}
		},
	};
}
