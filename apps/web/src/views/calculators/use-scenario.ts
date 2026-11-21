/**
 * @file 测算方案的串行保存、按需自动保存与离开保护。
 * 创建时间：2026-11-05；修改时间：2026-11-21。
 * 版本作用：只确认已提交快照；支持提交前不覆写本地草稿的原子应用，并在失败期间继续编辑后恢复自动保存。
 * 被调用：增值税与滞纳金编辑器；调用：Eden、TanStack blocker、Sonner。
 * 预期结果：切换方案先保存，导入/清空失败不破坏本地草稿与撤销栈，冲突停止重试并保留本地内存供导出备份。
 */
import { useBlocker } from "@tanstack/react-router";
import {
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { useCalculatorNavigation } from "@/components/layout/calculator-navigation-provider";
import type { CalculatorKind } from "@/lib/calculator-directory";
import { CalculatorError, calculatorError } from "@/lib/calculators";

const AUTO_SAVE_DELAY_MS = 5000;

export function useScenario<
	D extends { name: string },
	R extends {
		id: string;
		revision: number;
		archived: boolean;
		updatedAt: Date | string;
	},
>(
	record: R,
	initial: D,
	save: (id: string, revision: number, data: D) => Promise<R>,
	onSaved: (row: R) => void,
	kind: CalculatorKind,
) {
	const { register } = useCalculatorNavigation();
	const mutationLock = useRef(false);
	const [mutating, setMutating] = useState(false);
	const [archived, setArchived] = useState(record.archived);
	const [draft, setDraft] = useState<D>(initial);
	const [dirty, setDirty] = useState(false);

	const current = useRef(draft);
	current.current = draft;
	const savedSnapshot = useRef<D>(initial);
	const savedJson = useRef<string | null>(null);
	const version = useRef(0);
	const savedVersion = useRef(0);
	const failedVersion = useRef(-1);
	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const revision = useRef(record.revision);
	const blocked = useRef(false);
	const live = useRef(true);
	const pending = useRef<Promise<boolean> | null>(null);
	const savedCallback = useRef(onSaved);
	savedCallback.current = onSaved;
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState(record.updatedAt);
	const [error, setError] = useState("");

	const clearAutoSaveTimer = useCallback(() => {
		if (autoSaveTimer.current !== null) {
			clearTimeout(autoSaveTimer.current);
			autoSaveTimer.current = null;
		}
	}, []);

	const persistRef = useRef<() => Promise<boolean>>(async () => false);

	const scheduleAutoSave = useCallback(() => {
		if (
			autoSaveTimer.current !== null ||
			!live.current ||
			mutationLock.current ||
			archived ||
			blocked.current ||
			version.current === savedVersion.current ||
			version.current === failedVersion.current
		)
			return;
		autoSaveTimer.current = setTimeout(() => {
			autoSaveTimer.current = null;
			if (
				!live.current ||
				mutationLock.current ||
				archived ||
				pending.current ||
				blocked.current ||
				version.current === savedVersion.current ||
				version.current === failedVersion.current
			)
				return;
			void persistRef.current();
		}, AUTO_SAVE_DELAY_MS);
	}, [archived]);

	const persist = useCallback(async (): Promise<boolean> => {
		clearAutoSaveTimer();
		while (pending.current) await pending.current;
		const snapshot = current.current;
		const targetVersion = version.current;
		if (targetVersion === savedVersion.current) {
			if (live.current) {
				setDirty(false);
				setError("");
			}
			failedVersion.current = -1;
			toast.dismiss(`calculator-save-${record.id}`);
			return true;
		}
		const fingerprint = JSON.stringify(snapshot);
		if (savedJson.current === null) {
			savedJson.current = JSON.stringify(savedSnapshot.current);
		}
		const baseline = savedJson.current;
		if (fingerprint === baseline) {
			savedSnapshot.current = snapshot;
			savedVersion.current = targetVersion;
			failedVersion.current = -1;
			if (live.current) {
				if (version.current === targetVersion) setDirty(false);
				setError("");
			}
			toast.dismiss(`calculator-save-${record.id}`);
			return true;
		}
		if (blocked.current || archived) return false;
		const request = (async () => {
			if (live.current) setSaving(true);
			try {
				if (!snapshot.name.trim()) throw Error("请填写方案名称");
				const result = await save(record.id, revision.current, snapshot);
				revision.current = result.revision;
				savedSnapshot.current = snapshot;
				savedJson.current = fingerprint;
				savedVersion.current = targetVersion;
				failedVersion.current = -1;
				if (live.current) {
					setSavedAt(result.updatedAt);
					setError("");
					if (version.current === targetVersion) setDirty(false);
					else scheduleAutoSave();
					savedCallback.current(result);
					toast.dismiss(`calculator-save-${record.id}`);
				}
				return true;
			} catch (cause) {
				failedVersion.current = targetVersion;
				if (
					cause instanceof CalculatorError &&
					[401, 403, 404, 409].includes(cause.status)
				)
					blocked.current = true;
				if (live.current) {
					setError(calculatorError(cause));
					toast.error(calculatorError(cause), {
						id: `calculator-save-${record.id}`,
						description: "当前输入仍保留，可导出方案备份。",
						duration: 8000,
					});
				}
				return false;
			} finally {
				if (live.current) setSaving(false);
			}
		})();
		pending.current = request;
		try {
			return await request;
		} finally {
			if (pending.current === request) pending.current = null;
			if (
				live.current &&
				!blocked.current &&
				version.current !== savedVersion.current &&
				version.current !== failedVersion.current
			)
				scheduleAutoSave();
		}
	}, [record.id, save, archived, clearAutoSaveTimer, scheduleAutoSave]);

	/** 事务性应用外部整批变更（如导入历史、清空调整）：仅在保存成功后才覆写本地草稿与版本。 */
	const apply = useCallback(
		async (updater: (prev: D) => D): Promise<boolean> => {
			if (mutationLock.current || archived || blocked.current) return false;
			clearAutoSaveTimer();
			while (pending.current) await pending.current;
			if (mutationLock.current || archived || blocked.current) return false;
			const snapshot = updater(current.current);
			const fingerprint = JSON.stringify(snapshot);
			const request = (async () => {
				if (live.current) setSaving(true);
				try {
					if (!snapshot.name.trim()) throw Error("请填写方案名称");
					const result = await save(record.id, revision.current, snapshot);
					revision.current = result.revision;
					current.current = snapshot;
					savedSnapshot.current = snapshot;
					savedJson.current = fingerprint;
					version.current += 1;
					savedVersion.current = version.current;
					failedVersion.current = -1;
					if (live.current) {
						setDraft(snapshot);
						setDirty(false);
						setSavedAt(result.updatedAt);
						setError("");
						savedCallback.current(result);
						toast.dismiss(`calculator-save-${record.id}`);
					}
					return true;
				} catch (cause) {
					if (
						cause instanceof CalculatorError &&
						[401, 403, 404, 409].includes(cause.status)
					)
						blocked.current = true;
					if (live.current) {
						setError(calculatorError(cause));
						toast.error(calculatorError(cause), {
							id: `calculator-save-${record.id}`,
							description: "当前输入仍保留，可导出方案备份。",
							duration: 8000,
						});
					}
					return false;
				} finally {
					if (live.current) setSaving(false);
				}
			})();
			pending.current = request;
			try {
				return await request;
			} finally {
				if (pending.current === request) pending.current = null;
				if (
					live.current &&
					!blocked.current &&
					version.current !== savedVersion.current &&
					version.current !== failedVersion.current
				)
					scheduleAutoSave();
			}
		},
		[record.id, save, archived, clearAutoSaveTimer, scheduleAutoSave],
	);

	persistRef.current = persist;

	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
			clearAutoSaveTimer();
		};
	}, [clearAutoSaveTimer]);

	const flush = useCallback(async () => {
		for (;;) {
			while (pending.current) await pending.current;
			if (blocked.current) return false;
			if (version.current === savedVersion.current) return true;
			if (!(await persist())) return false;
		}
	}, [persist]);

	useEffect(
		() =>
			register({
				kind,
				id: record.id,
				prepare: async () => {
					mutationLock.current = true;
					clearAutoSaveTimer();
					setMutating(true);
					return (await flush()) ? revision.current : null;
				},
				finish: () => {
					mutationLock.current = false;
					if (live.current) {
						setMutating(false);
						scheduleAutoSave();
					}
				},
				accept: (row) => {
					revision.current = row.revision;
					const next = { ...current.current, name: row.name };
					current.current = next;
					savedSnapshot.current = next;
					savedJson.current = null;
					version.current += 1;
					savedVersion.current = version.current;
					failedVersion.current = -1;
					clearAutoSaveTimer();
					setDraft(next);
					setDirty(false);
					setArchived(row.archived);
					setSavedAt(row.updatedAt);
				},
			}),
		[register, kind, record.id, flush, clearAutoSaveTimer, scheduleAutoSave],
	);

	const blocker = useBlocker({
		shouldBlockFn: async () => {
			if (mutationLock.current) return true;
			return !(await flush());
		},
		enableBeforeUnload: () =>
			!!pending.current || version.current !== savedVersion.current,
		withResolver: true,
	});

	const change = useCallback(
		(action: SetStateAction<D>) => {
			if (mutationLock.current || archived) return;
			const next =
				typeof action === "function"
					? (action as (prev: D) => D)(current.current)
					: action;
			if (Object.is(next, current.current)) return;
			current.current = next;
			version.current += 1;
			setDraft(next);
			setDirty(true);
			scheduleAutoSave();
		},
		[archived, scheduleAutoSave],
	);

	return {
		draft,
		archived,
		readOnly: archived || mutating,
		change,
		apply,
		persist,
		saving,
		savedAt,
		error,
		blocker,
		dirty,
	};
}
