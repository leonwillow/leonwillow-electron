/**
 * @file 当前用户、当前案件的图谱显示偏好。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：只保存标记和隐藏状态，不写入案件事实或图数据库。
 * 被调用：analysis-panel；调用：useLocalStorageState、model/graph-presentation。
 * 功能：保存、恢复、跨窗口同步；无法持久化时明确提示。
 * 预期结果：刷新保留偏好，用户和案件互相隔离。
 */
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import {
	decodeGraphPresentation,
	type GraphPresentation,
	graphPresentationStorageKey,
	type NodePresentation,
} from "./model/graph-presentation";

export function useGraphPresentation(userId: string, caseId: string) {
	const {
		value: entries,
		save,
		error,
	} = useLocalStorageState<GraphPresentation>({
		key: graphPresentationStorageKey(userId, caseId),
		decode: decodeGraphPresentation,
		encode: (next) => JSON.stringify({ version: 1, nodes: next }),
		saveErrorMessage:
			"浏览器未能保存图谱偏好，本次修改仍可用，刷新后可能丢失。",
	});

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
