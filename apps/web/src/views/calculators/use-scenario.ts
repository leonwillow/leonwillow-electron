/**
 * @file 测算方案的串行保存、自动保存与离开保护。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：只确认已提交快照；异步返回不覆盖继续输入的值。
 * 被调用：增值税与滞纳金编辑器；调用：Eden、TanStack blocker、Sonner。
 * 预期结果：切换方案先保存，冲突停止重试并保留本地内存供导出备份。
 */
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCalculatorNavigation } from "@/components/layout/calculator-navigation-provider";
import type { CalculatorKind } from "@/lib/calculator-directory";
import { CalculatorError, calculatorError } from "@/lib/calculators";
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

	const current = useRef(draft);
	current.current = draft;
	const saved = useRef(JSON.stringify(draft));
	const revision = useRef(record.revision);
	const failed = useRef("");
	const blocked = useRef(false);
	const live = useRef(true);
	const pending = useRef<Promise<boolean> | null>(null);
	const savedCallback = useRef(onSaved);
	savedCallback.current = onSaved;
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState(record.updatedAt);
	const [error, setError] = useState("");
	const persist = useCallback(async (): Promise<boolean> => {
		while (pending.current) await pending.current;
		const snapshot = current.current;
		const fingerprint = JSON.stringify(snapshot);
		if (fingerprint === saved.current) {
			setError("");
			failed.current = "";
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
				saved.current = fingerprint;
				failed.current = "";
				if (live.current) {
					setSavedAt(result.updatedAt);
					setError("");
					savedCallback.current(result);
					toast.dismiss(`calculator-save-${record.id}`);
				}
				return true;
			} catch (cause) {
				failed.current = fingerprint;
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
		}
	}, [record.id, save, archived]);
	useEffect(() => {
		live.current = true;
		const timer = setInterval(() => {
			const fingerprint = JSON.stringify(current.current);
			if (
				!mutationLock.current &&
				!archived &&
				!pending.current &&
				!blocked.current &&
				fingerprint !== saved.current &&
				fingerprint !== failed.current
			)
				void persist();
		}, 5000);
		return () => {
			live.current = false;
			clearInterval(timer);
		};
	}, [persist, archived]);
	const flush = useCallback(async () => {
		for (;;) {
			while (pending.current) await pending.current;
			if (blocked.current) return false;
			if (JSON.stringify(current.current) === saved.current) return true;
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
					setMutating(true);
					return (await flush()) ? revision.current : null;
				},
				finish: () => {
					mutationLock.current = false;
					if (live.current) setMutating(false);
				},
				accept: (row) => {
					revision.current = row.revision;
					const next = { ...current.current, name: row.name };
					current.current = next;
					saved.current = JSON.stringify(next);
					setDraft(next);
					setArchived(row.archived);
					setSavedAt(row.updatedAt);
				},
			}),
		[register, kind, record.id, flush],
	);
	const blocker = useBlocker({
		shouldBlockFn: async () => {
			if (mutationLock.current) return true;
			return !(await flush());
		},
		enableBeforeUnload: () =>
			!!pending.current || JSON.stringify(current.current) !== saved.current,
		withResolver: true,
	});
	const change = (value: D) => {
		if (mutationLock.current || archived) return;
		current.current = value;
		setDraft(value);
	};
	return {
		draft,
		archived,
		readOnly: archived || mutating,
		change,
		persist,
		saving,
		savedAt,
		error,
		blocker,
		dirty: JSON.stringify(draft) !== saved.current,
	};
}
