/**
 * @file 当前用户、当前案件的图谱显示偏好。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：只保存标记和隐藏状态，不写入案件事实或图数据库。
 * 被调用：analysis-panel；调用：版本化编解码、浏览器存储。
 * 功能：保存、恢复、跨窗口同步；无法持久化时明确提示。
 * 预期结果：刷新保留偏好，用户和案件互相隔离。
 */
import { useEffect, useState } from "react";
import {
	decodeGraphPresentation,
	type GraphPresentation,
	graphPresentationStorageKey,
	type NodePresentation,
} from "@/lib/funds-graph-presentation";

export function useGraphPresentation(userId: string, caseId: string) {
	const key = graphPresentationStorageKey(userId, caseId);
	const [entries, setEntries] = useState<GraphPresentation>(() => {
		try {
			return decodeGraphPresentation(localStorage.getItem(key));
		} catch {
			return {};
		}
	});
	const [error, setError] = useState("");
	useEffect(() => {
		const sync = (event: StorageEvent) => {
			if (
				event.storageArea === localStorage &&
				(event.key === key || event.key === null)
			)
				setEntries(decodeGraphPresentation(event.newValue));
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [key]);
	/** 整体保存个人偏好；失败时保留本次页面状态并显示错误，不谎报已持久化。 */
	const save = (next: GraphPresentation) => {
		setEntries(next);
		try {
			localStorage.setItem(key, JSON.stringify({ version: 1, nodes: next }));
			setError("");
		} catch {
			setError("浏览器未能保存图谱偏好，本次修改仍可用，刷新后可能丢失。");
		}
	};
	return {
		entries,
		error,
		setHidden: (keys: string[]) => {
			const hidden = new Set(keys);
			const next = { ...entries };
			for (const id of new Set([...Object.keys(entries), ...keys]))
				next[id] = { ...next[id], hidden: hidden.has(id) };
			save(next);
		},
		update: (id: string, patch: NodePresentation) =>
			save({ ...entries, [id]: { ...entries[id], ...patch } }),
		restore: (ids: string[]) =>
			save(
				Object.fromEntries(
					Object.entries(entries).map(([id, entry]) => [
						id,
						ids.includes(id) ? { ...entry, hidden: false } : entry,
					]),
				),
			),
	};
}
