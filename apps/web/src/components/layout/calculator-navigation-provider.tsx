/**
 * @file 计算器目录资源与编辑器保存协调上下文。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：共享两种方案摘要，目录变更前锁定并保存匹配的当前编辑器。
 * 被调用：WorkspaceLayout、计算器菜单及 useScenario；调用：React、Eden 目录适配。
 * 预期结果：关闭浮层保留目录状态，旧请求不覆盖新摘要，保存失败阻止目录写入。
 */
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type CalculatorKind,
	type CalculatorSummary,
	calculatorDirectory,
	calculatorKinds,
} from "@/lib/calculator-directory";
import { calculatorError } from "@/lib/calculators";

type Editor = {
	kind: CalculatorKind;
	id: string;
	prepare: () => Promise<number | null>;
	finish: () => void;
	accept: (row: CalculatorSummary) => void;
};
type Resource = { rows: CalculatorSummary[]; loading: boolean; error: string };
const initial = (): Record<CalculatorKind, Resource> => ({
	vat: { rows: [], loading: false, error: "" },
	"late-fees": { rows: [], loading: false, error: "" },
});
function useCalculatorState(enabled: boolean) {
	const [resources, setResources] = useState(initial);
	const [archived, setArchived] = useState(false);
	const [expanded, setExpanded] = useState<string[]>([...calculatorKinds]);
	const generations = useRef({ vat: 0, "late-fees": 0 });
	const changeSequence = useRef(0);
	const changes = useRef<Record<CalculatorKind, Map<string, number>>>({
		vat: new Map(),
		"late-fees": new Map(),
	});
	const active = useRef<Editor | null>(null);
	const locked = useRef<Editor | null>(null);
	const reload = useCallback(
		async (kind: CalculatorKind) => {
			if (!enabled) return;
			const generation = ++generations.current[kind];
			const startedSequence = changeSequence.current;
			setResources((old) => ({
				...old,
				[kind]: { ...old[kind], loading: true, error: "" },
			}));
			try {
				const rows = await calculatorDirectory[kind].list();
				if (generations.current[kind] === generation)
					setResources((old) => ({
						...old,
						[kind]: {
							rows: [
								...rows.map((row) => {
									const current = old[kind].rows.find((r) => r.id === row.id);
									return current && current.revision > row.revision
										? current
										: row;
								}),
								...old[kind].rows.filter(
									(row) =>
										!rows.some((incoming) => incoming.id === row.id) &&
										(changes.current[kind].get(row.id) ?? 0) > startedSequence,
								),
							],
							loading: false,
							error: "",
						},
					}));
			} catch (cause) {
				if (generations.current[kind] === generation)
					setResources((old) => ({
						...old,
						[kind]: {
							...old[kind],
							loading: false,
							error: calculatorError(cause),
						},
					}));
			}
		},
		[enabled],
	);
	useEffect(() => {
		for (const kind of calculatorKinds) void reload(kind);
		return () => {
			for (const kind of calculatorKinds) generations.current[kind]++;
		};
	}, [reload]);
	const upsert = useCallback((kind: CalculatorKind, row: CalculatorSummary) => {
		changes.current[kind].set(row.id, ++changeSequence.current);
		const summary = {
			id: row.id,
			name: row.name,
			archived: row.archived,
			revision: row.revision,
			updatedAt: row.updatedAt,
		};
		// 保持既有行顺序，自动保存不让鼠标下的操作按钮换行；重新加载才按服务端排序。
		setResources((old) => ({
			...old,
			[kind]: {
				...old[kind],
				rows: old[kind].rows.some((r) => r.id === row.id)
					? old[kind].rows.map((r) =>
							r.id === row.id && r.revision <= row.revision ? summary : r,
						)
					: [...old[kind].rows, summary],
			},
		}));
	}, []);
	const register = useCallback((editor: Editor) => {
		active.current = editor;
		return () => {
			if (active.current === editor) active.current = null;
		};
	}, []);
	/** undefined 表示非当前方案，null 表示保存失败/编辑器已切换；调用方总在 finally 释放锁。 */
	const prepare = useCallback(async (kind: CalculatorKind, id: string) => {
		if (locked.current) return null;
		const editor = active.current;
		if (!editor || editor.kind !== kind || editor.id !== id) return undefined;
		locked.current = editor;
		const revision = await editor.prepare();
		return active.current === editor ? revision : null;
	}, []);
	const finish = useCallback(() => {
		locked.current?.finish();
		locked.current = null;
	}, []);
	const accept = useCallback(
		(kind: CalculatorKind, row: CalculatorSummary) => {
			if (
				locked.current === active.current &&
				locked.current?.kind === kind &&
				locked.current.id === row.id
			)
				locked.current.accept(row);
			upsert(kind, row);
		},
		[upsert],
	);
	return useMemo(
		() => ({
			resources,
			reload,
			upsert,
			archived,
			setArchived,
			expanded,
			setExpanded,
			register,
			prepare,
			finish,
			accept,
		}),
		[
			resources,
			reload,
			upsert,
			archived,
			expanded,
			register,
			prepare,
			finish,
			accept,
		],
	);
}
const Context = createContext<ReturnType<typeof useCalculatorState> | null>(
	null,
);
export function CalculatorNavigationProvider({
	enabled,
	children,
}: {
	enabled: boolean;
	children: ReactNode;
}) {
	return <Context value={useCalculatorState(enabled)}>{children}</Context>;
}
export function useCalculatorNavigation() {
	const state = useContext(Context);
	if (!state) throw Error("计算器必须位于工作台计算器上下文中。");
	return state;
}
