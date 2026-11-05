/**
 * @file 笔录编辑历史、串行保存和离开保护。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：串行保存笔录，仅确认已提交快照；失败通过错误通知反馈，冲突停止自动重试。
 * 被调用：RecordEditor；调用：React、TanStack blocker、Eden、Sonner、笔录目录资源与操作协调。
 * 预期结果：保存期间继续输入不会误标已保存，切换案件先保存；目录归档/删除先锁定并保存。
 */
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { useInquiryEditorActions } from "@/components/layout/inquiry-editor-actions";
import { useInquiryNavigation } from "@/components/layout/inquiry-navigation-provider";
import {
	type InquiryDocument,
	InquiryError,
	type InquiryRecord,
	inquiryError,
	updateInquiryRecord,
} from "@/lib/inquiries";

type Editable = Pick<InquiryDocument, "title" | "content">;
type History = {
	past: Editable[];
	present: Editable;
	future: Editable[];
	time: number;
};
type Action =
	| { type: "edit"; value: Editable; time: number }
	| { type: "undo" | "redo" };
function reducer(state: History, action: Action): History {
	if (action.type === "edit") {
		if (JSON.stringify(action.value) === JSON.stringify(state.present))
			return state;
		return {
			past:
				action.time - state.time > 400 || !state.past.length
					? [...state.past, state.present].slice(-100)
					: state.past,
			present: action.value,
			future: [],
			time: action.time,
		};
	}
	if (action.type === "undo") {
		const value = state.past.at(-1);
		return value
			? {
					past: state.past.slice(0, -1),
					present: value,
					future: [state.present, ...state.future],
					time: 0,
				}
			: state;
	}
	const value = state.future[0];
	return value
		? {
				past: [...state.past, state.present],
				present: value,
				future: state.future.slice(1),
				time: 0,
			}
		: state;
}
export function useInquiryEditor(record: InquiryRecord, readOnly: boolean) {
	const errorToastId = `inquiry-save-error-${record.id}`;
	const { cases } = useInquiryNavigation();
	const { registerEditor } = useInquiryEditorActions();
	const reloadCases = cases.reload;
	const [history, dispatch] = useReducer(reducer, {
		past: [],
		present: { title: record.title, content: record.content },
		future: [],
		time: 0,
	});
	const current = useRef(history.present);
	current.current = history.present;
	const saved = useRef(
		JSON.stringify({ title: record.title, content: record.content }),
	);
	const revision = useRef(record.revision);
	const lastRecord = useRef(record);
	const pending = useRef<Promise<InquiryRecord | null> | null>(null);
	const live = useRef(true);
	const blocked = useRef(false);
	const failedFingerprint = useRef<string | null>(null);
	const mutationLock = useRef(false);
	const [mutating, setMutating] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [savedAt, setSavedAt] = useState(record.updatedAt);
	const dirty = JSON.stringify(history.present) !== saved.current;
	const persistSnapshot = useCallback(
		async (forMutation = false): Promise<InquiryRecord | null> => {
			while (pending.current) await pending.current;
			if (mutationLock.current && !forMutation) return null;
			if (readOnly) return lastRecord.current;
			if (blocked.current) return null;
			const snapshot = current.current;
			const fingerprint = JSON.stringify(snapshot);
			if (fingerprint === saved.current) {
				failedFingerprint.current = null;
				setError("");
				toast.dismiss(errorToastId);
				return lastRecord.current;
			}
			setSaving(true);
			setError("");
			const request = (async () => {
				try {
					const result = await updateInquiryRecord(
						record.caseId,
						record.id,
						snapshot,
						revision.current,
					);
					revision.current = result.revision;
					lastRecord.current = result;
					saved.current = fingerprint;
					failedFingerprint.current = null;
					toast.dismiss(errorToastId);
					void reloadCases();
					if (live.current) {
						setSavedAt(result.updatedAt);
					}
					return result;
				} catch (cause) {
					failedFingerprint.current = fingerprint;
					if (
						cause instanceof InquiryError &&
						[401, 403, 404, 409].includes(cause.status)
					)
						blocked.current = true;
					if (live.current) {
						const message = inquiryError(cause);
						setError(message);
						// 同一笔录复用通知 ID；自动保存仍跳过失败快照，避免连续弹错。
						toast.error(message, {
							id: errorToastId,
							closeButton: true,
							duration: blocked.current ? Number.POSITIVE_INFINITY : 6000,
							description: blocked.current
								? "请先复制需要保留的内容，再重新打开这份笔录。"
								: undefined,
						});
					}
					return null;
				} finally {
					pending.current = null;
					if (live.current) setSaving(false);
				}
			})();
			pending.current = request;
			return request;
		},
		[record.caseId, record.id, readOnly, reloadCases, errorToastId],
	);
	const persist = useCallback(
		() => (mutationLock.current ? Promise.resolve(null) : persistSnapshot()),
		[persistSnapshot],
	);
	const actionsRef = useRef({
		prepare: async (): Promise<{ id: string; revision: number } | null> => null,
		finish: () => {},
	});
	actionsRef.current = {
		prepare: async () => {
			mutationLock.current = true;
			setMutating(true);
			while (pending.current) await pending.current;
			if (!live.current || blocked.current) return null;
			while (!readOnly && JSON.stringify(current.current) !== saved.current) {
				if (!(await persistSnapshot(true))) return null;
			}
			if (!live.current) return null;
			return { id: record.id, revision: revision.current };
		},
		finish: () => {
			mutationLock.current = false;
			if (live.current) setMutating(false);
		},
	};
	useEffect(
		() =>
			registerEditor({
				caseId: record.caseId,
				recordId: record.id,
				prepare: () => actionsRef.current.prepare(),
				finish: () => actionsRef.current.finish(),
			}),
		[record.caseId, record.id, registerEditor],
	);
	useEffect(() => {
		live.current = true;
		const timer = setInterval(() => {
			const fingerprint = JSON.stringify(current.current);
			if (
				!readOnly &&
				!mutationLock.current &&
				!blocked.current &&
				!pending.current &&
				fingerprint !== saved.current &&
				fingerprint !== failedFingerprint.current
			)
				void persist();
		}, 5000);
		return () => {
			live.current = false;
			clearInterval(timer);
			toast.dismiss(errorToastId);
		};
	}, [persist, readOnly, errorToastId]);
	const blocker = useBlocker({
		shouldBlockFn: async () => {
			if (readOnly) return false;
			// 离开请求期间仍可继续输入；每次保存后复核最新内容，直到全部落库。
			for (;;) {
				while (pending.current) await pending.current;
				if (JSON.stringify(current.current) === saved.current) return false;
				if (!(await persist())) return true;
			}
		},
		enableBeforeUnload: () =>
			!readOnly &&
			(pending.current !== null ||
				JSON.stringify(current.current) !== saved.current),
		withResolver: true,
	});
	return {
		draft: history.present,
		dirty,
		saving,
		mutating,
		error,
		savedAt,
		persist,
		blocker,
		conflicted: blocked.current,
		change: (value: Editable) => {
			if (!readOnly && !mutationLock.current)
				dispatch({ type: "edit", value, time: Date.now() });
		},
		undo: () => {
			if (!readOnly && !mutationLock.current) dispatch({ type: "undo" });
		},
		redo: () => {
			if (!readOnly && !mutationLock.current) dispatch({ type: "redo" });
		},
		canUndo: history.past.length > 0 && !readOnly && !mutating,
		canRedo: history.future.length > 0 && !readOnly && !mutating,
	};
}
