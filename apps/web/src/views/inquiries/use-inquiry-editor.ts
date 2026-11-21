/**
 * @file 笔录编辑历史、串行保存、按需自动保存和离开保护。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：以单调编辑版本号追踪脏状态并按需调度自动保存，消除每次按键/渲染的整篇 JSON.stringify 与空闲 setInterval 轮询。
 * 被调用：RecordEditor、编辑器历史单元测试；调用：React、TanStack blocker、Eden、Sonner、笔录目录资源与操作协调。
 * 预期结果：保存期间继续输入不会误标已保存，撤销-改名-重做不发生 rev 碰撞，撤销回已保存版本立即清除脏状态。
 */
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { useInquiryEditorActions } from "@/components/layout/inquiry-editor-actions";
import { useInquiryNavigation } from "@/components/layout/inquiry-navigation-provider";
import {
	InquiryError,
	type InquiryRecord,
	inquiryError,
	updateInquiryRecord,
} from "@/lib/inquiries";
import {
	type InquiryEditable,
	inquiryHistoryReducer,
	nextInquirySyncedRev,
} from "./inquiry-editor-history";

const AUTO_SAVE_DELAY_MS = 5000;

export function useInquiryEditor(record: InquiryRecord, readOnly: boolean) {
	const errorToastId = `inquiry-save-error-${record.id}`;
	const { cases } = useInquiryNavigation();
	const { registerEditor } = useInquiryEditorActions();
	const reloadCases = cases.reload;
	const [history, dispatch] = useReducer(inquiryHistoryReducer, {
		past: [],
		present: {
			value: { title: record.title, content: record.content },
			rev: 0,
		},
		future: [],
		nextRev: 0,
		time: 0,
	});
	const [savedRev, setSavedRev] = useState(0);

	const current = useRef(history.present);
	current.current = history.present;
	const nextRevRef = useRef(history.nextRev);
	nextRevRef.current = Math.max(nextRevRef.current, history.nextRev);
	const savedRevRef = useRef(0);
	const failedRevRef = useRef(-1);
	const savedJson = useRef<string | null>(null);
	const savedSnapshot = useRef<InquiryEditable>({
		title: record.title,
		content: record.content,
	});
	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const revision = useRef(record.revision);
	const lastRecord = useRef(record);
	const pending = useRef<Promise<InquiryRecord | null> | null>(null);
	const live = useRef(true);
	const blocked = useRef(false);
	const mutationLock = useRef(false);
	const [mutating, setMutating] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [savedAt, setSavedAt] = useState(record.updatedAt);

	const dirty = history.present.rev !== savedRev;

	const clearAutoSaveTimer = useCallback(() => {
		if (autoSaveTimer.current !== null) {
			clearTimeout(autoSaveTimer.current);
			autoSaveTimer.current = null;
		}
	}, []);

	const persistRef = useRef<() => Promise<InquiryRecord | null>>(
		async () => null,
	);

	const scheduleAutoSave = useCallback(() => {
		if (
			autoSaveTimer.current !== null ||
			!live.current ||
			readOnly ||
			mutationLock.current ||
			blocked.current ||
			current.current.rev === savedRevRef.current ||
			current.current.rev === failedRevRef.current
		)
			return;
		autoSaveTimer.current = setTimeout(() => {
			autoSaveTimer.current = null;
			if (
				!live.current ||
				readOnly ||
				mutationLock.current ||
				blocked.current ||
				pending.current ||
				current.current.rev === savedRevRef.current ||
				current.current.rev === failedRevRef.current
			)
				return;
			void persistRef.current();
		}, AUTO_SAVE_DELAY_MS);
	}, [readOnly]);

	const persistSnapshot = useCallback(
		async (forMutation = false): Promise<InquiryRecord | null> => {
			clearAutoSaveTimer();
			while (pending.current) await pending.current;
			if (mutationLock.current && !forMutation) return null;
			if (readOnly) return lastRecord.current;
			if (blocked.current) return null;

			const { value: snapshot, rev: targetRev } = current.current;
			if (targetRev === savedRevRef.current) {
				failedRevRef.current = -1;
				if (live.current) setError("");
				toast.dismiss(errorToastId);
				return lastRecord.current;
			}

			const fingerprint = JSON.stringify(snapshot);
			if (savedJson.current === null) {
				savedJson.current = JSON.stringify(savedSnapshot.current);
			}
			if (fingerprint === savedJson.current) {
				savedSnapshot.current = snapshot;
				savedRevRef.current = targetRev;
				failedRevRef.current = -1;
				if (live.current) {
					setSavedRev(targetRev);
					setError("");
				}
				toast.dismiss(errorToastId);
				return lastRecord.current;
			}

			if (live.current) {
				setSaving(true);
				setError("");
			}
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
					savedSnapshot.current = snapshot;
					savedJson.current = fingerprint;
					savedRevRef.current = targetRev;
					failedRevRef.current = -1;
					toast.dismiss(errorToastId);
					void reloadCases();
					if (live.current) {
						setSavedRev(targetRev);
						setSavedAt(result.updatedAt);
						if (current.current.rev !== targetRev) scheduleAutoSave();
					}
					return result;
				} catch (cause) {
					failedRevRef.current = targetRev;
					if (
						cause instanceof InquiryError &&
						[401, 403, 404, 409].includes(cause.status)
					)
						blocked.current = true;
					if (live.current) {
						const message = inquiryError(cause);
						setError(message);
						// 同一笔录复用通知 ID；自动保存跳过失败版本，避免连续弹错。
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
					if (live.current) {
						setSaving(false);
						if (
							!blocked.current &&
							current.current.rev !== savedRevRef.current &&
							current.current.rev !== failedRevRef.current
						)
							scheduleAutoSave();
					}
				}
			})();
			pending.current = request;
			return request;
		},
		[
			record.caseId,
			record.id,
			readOnly,
			reloadCases,
			errorToastId,
			clearAutoSaveTimer,
			scheduleAutoSave,
		],
	);

	const persist = useCallback(
		() => (mutationLock.current ? Promise.resolve(null) : persistSnapshot()),
		[persistSnapshot],
	);
	persistRef.current = persist;

	const presentRev = history.present.rev;
	useEffect(() => {
		if (presentRev !== savedRev) scheduleAutoSave();
		else clearAutoSaveTimer();
	}, [presentRev, savedRev, scheduleAutoSave, clearAutoSaveTimer]);

	const actionsRef = useRef({
		prepare: async (): Promise<{ id: string; revision: number } | null> => null,
		finish: () => {},
		accept: (_updated: InquiryRecord) => {},
	});
	actionsRef.current = {
		prepare: async () => {
			mutationLock.current = true;
			clearAutoSaveTimer();
			setMutating(true);
			while (pending.current) await pending.current;
			if (!live.current || blocked.current) return null;
			while (!readOnly && current.current.rev !== savedRevRef.current) {
				if (!(await persistSnapshot(true))) return null;
			}
			if (!live.current) return null;
			return { id: record.id, revision: revision.current };
		},
		accept: (updated) => {
			// 目录改名已在锁内保存正文；同步修订和历史标题，避免后续自动保存覆盖新名称。
			revision.current = updated.revision;
			lastRecord.current = updated;
			const nextEditable: InquiryEditable = {
				title: updated.title,
				content: updated.content,
			};
			const syncedRev = nextInquirySyncedRev(
				nextRevRef.current,
				current.current.rev,
			);
			nextRevRef.current = syncedRev;
			current.current = { value: nextEditable, rev: syncedRev };
			savedSnapshot.current = nextEditable;
			savedJson.current = null;
			savedRevRef.current = syncedRev;
			failedRevRef.current = -1;
			clearAutoSaveTimer();
			setSavedRev(syncedRev);
			setSavedAt(updated.updatedAt);
			dispatch({ type: "rename", title: updated.title, syncedRev });
		},
		finish: () => {
			mutationLock.current = false;
			if (live.current) {
				setMutating(false);
				scheduleAutoSave();
			}
		},
	};
	useEffect(
		() =>
			registerEditor({
				caseId: record.caseId,
				recordId: record.id,
				prepare: () => actionsRef.current.prepare(),
				finish: () => actionsRef.current.finish(),
				accept: (updated) => actionsRef.current.accept(updated),
			}),
		[record.caseId, record.id, registerEditor],
	);
	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
			clearAutoSaveTimer();
			toast.dismiss(errorToastId);
		};
	}, [clearAutoSaveTimer, errorToastId]);
	const blocker = useBlocker({
		shouldBlockFn: async () => {
			if (readOnly) return false;
			if (mutationLock.current) return true;
			// 离开请求期间仍可继续输入；每次保存后复核最新版本，直到全部落库。
			for (;;) {
				while (pending.current) await pending.current;
				if (current.current.rev === savedRevRef.current) return false;
				if (!(await persist())) return true;
			}
		},
		enableBeforeUnload: () =>
			!readOnly &&
			(pending.current !== null || current.current.rev !== savedRevRef.current),
		withResolver: true,
	});
	return {
		draft: history.present.value,
		dirty,
		saving,
		mutating,
		error,
		savedAt,
		persist,
		blocker,
		conflicted: blocked.current,
		change: (value: InquiryEditable) => {
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
