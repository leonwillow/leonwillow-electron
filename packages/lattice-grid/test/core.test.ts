/**
 * @file Lattice Grid 迁移的纯内核行为回归。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 来源：MIT 原项目 core.test.ts；运行：bun test；使用独立虚构行，不访问业务数据。
 */
import { describe, expect, it, mock } from "bun:test";
import {
	type Column,
	columnAddress,
	createGrid,
	createGridState,
	formatGridError,
	type GridOptions,
	type GridState,
	numericFilter,
	parseDelimited,
	stringifyDelimited,
	validateCell,
} from "../src/core";

type Row = {
	id: string;
	name: string;
	amount: number | null;
	region: string;
	date: string;
};
const columns: [Column<Row>, Column<Row>, Column<Row>, Column<Row>] = [
	{ id: "name", field: "name", header: "Name", required: true },
	{
		id: "amount",
		field: "amount",
		header: "Amount",
		type: "number",
		min: 0,
		max: 100,
		integer: true,
	},
	{
		id: "region",
		field: "region",
		header: "Region",
		type: "select",
		options: ["B", "A"],
	},
	{ id: "date", field: "date", header: "Date", type: "date" },
];
const rows: [Row, Row, Row] = [
	{ id: "a", name: "Alpha", amount: 10, region: "B", date: "2024-02-29" },
	{ id: "b", name: "Beta", amount: 20, region: "A", date: "2025-01-01" },
	{ id: "c", name: "Gamma", amount: 30, region: "B", date: "2026-09-27" },
];
const getRowId = (r: Row) => r.id;
const make = (extra: Partial<GridOptions<Row>> = {}) =>
	createGrid({ rows, columns, getRowId, ...extra });
describe("identity and derivation", () => {
	it("rejects duplicate row IDs and dangerous fields", () => {
		expect(() => make({ rows: [rows[0], rows[0]] })).toThrow("unique");
		expect(() => make({ columns: [{ id: "__proto__", header: "x" }] })).toThrow(
			"safe",
		);
	});
	it("combines search, typed filters and stable multi-sort without mutation", () => {
		const grid = make();
		grid.setState({
			search: "a",
			filters: { amount: ">= 20" },
			sorting: [{ id: "region", direction: "asc" }],
		});
		expect(grid.getSnapshot().viewRows.map((r) => r.id)).toEqual(["c", "b"]);
		expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
	});
	it("keeps derived rows referentially stable during selection and resizing", () => {
		const g = make();
		const view = g.getSnapshot().viewRows;
		g.select({ rowId: "a", columnId: "name" });
		g.setColumn("name", { width: 220 });
		expect(g.getSnapshot().viewRows).toBe(view);
	});
	it("preserves selection identity after sorting and filters out absent coordinates", () => {
		const g = make();
		g.select({ rowId: "a", columnId: "name" });
		g.sort("name", false, "desc");
		expect(g.copySelection()).toBe("Alpha");
		g.setState({ search: "Beta" });
		expect(g.copySelection()).toBe("");
	});
	it("does not sort/filter a server-loaded page", () => {
		const g = make({ mode: "server", totalRows: 1000 });
		g.setState({
			search: "missing",
			sorting: [{ id: "amount", direction: "desc" }],
		});
		expect(g.getSnapshot().viewRows).toBe(rows);
	});
	it("supports fully controlled view state", () => {
		let state = createGridState(columns);
		const changes = mock((next: GridState) => {
			state = next;
		});
		const g = make({ state, onStateChange: changes });
		g.setState({ search: "Beta" });
		expect(g.getSnapshot().viewRows).toHaveLength(3);
		g.updateOptions({ rows, columns, getRowId, state });
		expect(g.getSnapshot().viewRows).toHaveLength(1);
	});
});
describe("atomic data changes", () => {
	it("applies immutable edits and undo/redo with row references preserved", async () => {
		const g = make();
		await g.edit({ rowId: "a", columnId: "amount" }, "25");
		expect(g.getSnapshot().rows[0]?.amount).toBe(25);
		expect(g.getSnapshot().rows[1]).toBe(rows[1]);
		await g.undo();
		expect(g.getSnapshot().rows).toBe(rows);
		await g.redo();
		expect(g.getSnapshot().rows[0]?.amount).toBe(25);
	});
	it("rejects a whole paste when one value is invalid", async () => {
		const g = make();
		g.select({ rowId: "a", columnId: "amount" });
		const result = await g.paste([["25"], ["101"]]);
		expect(result.ok).toBe(false);
		expect(g.getSnapshot().rows).toBe(rows);
		expect(g.getSnapshot().canUndo).toBe(false);
	});
	it("rejects overflow and writes to read-only columns", async () => {
		const g = make({
			columns: columns.map((c) =>
				c.id === "amount" ? { ...c, editable: false } : c,
			),
		});
		g.select({ rowId: "c", columnId: "amount" });
		expect((await g.paste([["1"], ["2"]])).ok).toBe(false);
		expect((await g.edit({ rowId: "a", columnId: "amount" }, "2")).ok).toBe(
			false,
		);
	});
	it("awaits async validation and persistence, rejecting atomically", async () => {
		const save = mock(async () => {
			throw new Error("Server refused");
		});
		const g = make({ onCommit: save });
		expect((await g.edit({ rowId: "a", columnId: "amount" }, "22")).ok).toBe(
			false,
		);
		expect(g.getSnapshot().rows).toBe(rows);
		expect(g.getSnapshot().error).toBe("Server refused");
	});
	it("prevents concurrent edits and stale server acknowledgements", async () => {
		let done!: () => void;
		let signal!: AbortSignal;
		const onCommit = mock((_tx, { signal: s }) => {
			signal = s;
			return new Promise<void>((r) => {
				done = r;
			});
		});
		const g = make({ onCommit });
		const pending = g.edit({ rowId: "a", columnId: "amount" }, "22");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect((await g.edit({ rowId: "b", columnId: "amount" }, "12")).ok).toBe(
			false,
		);
		const next = rows.map((r) => ({ ...r, amount: 99 }));
		g.updateOptions({ rows: next, columns, getRowId, onCommit });
		expect(signal.aborted).toBe(true);
		done();
		expect((await pending).ok).toBe(false);
		expect(g.getSnapshot().rows).toBe(next);
	});
	it("does not clear history when controlled parent echoes accepted rows", async () => {
		const g = make();
		await g.edit({ rowId: "a", columnId: "amount" }, "22");
		g.updateOptions({ rows: g.getSnapshot().rows, columns, getRowId });
		expect(g.getSnapshot().canUndo).toBe(true);
	});
	it("validates cross-field constraints against the entire proposed row", async () => {
		const g = make({
			columns: columns.map((c) =>
				c.id === "amount"
					? {
							...c,
							validate: (v, row) =>
								row.name === "VIP" && Number(v) < 50
									? "VIP minimum 50"
									: undefined,
						}
					: c,
			),
		});
		g.select({ rowId: "a", columnId: "name" });
		expect((await g.paste([["VIP", "49"]])).ok).toBe(false);
		expect((await g.paste([["VIP", "50"]])).ok).toBe(true);
	});
	it("cannot edit identity or mutate frozen source objects", async () => {
		const frozen = rows.map((r) => Object.freeze({ ...r }));
		const g = make({
			rows: frozen,
			columns: [...columns, { id: "id", field: "id", header: "ID" }],
		});
		expect((await g.edit({ rowId: "a", columnId: "id" }, "new")).ok).toBe(
			false,
		);
		expect((await g.edit({ rowId: "a", columnId: "amount" }, "33")).ok).toBe(
			true,
		);
		expect(frozen[0]?.amount).toBe(10);
	});
	it("fills numeric progressions and reverses deletion", async () => {
		const g = make({ allowDelete: true });
		g.select({ rowId: "a", columnId: "amount" });
		g.select({ rowId: "b", columnId: "amount" }, true);
		await g.fillTo(2);
		expect(g.getSnapshot().rows[2]?.amount).toBe(30);
		await g.deleteRows(["b"]);
		expect(g.getSnapshot().rows).toHaveLength(2);
		await g.undo();
		expect(g.getSnapshot().rows).toHaveLength(3);
	});
	it("enforces readOnly for API edits, deletion and history", async () => {
		const g = make({ readOnly: true, allowDelete: true });
		expect((await g.edit({ rowId: "a", columnId: "amount" }, "50")).ok).toBe(
			false,
		);
		expect((await g.deleteRows(["a"])).ok).toBe(false);
		expect(g.getSnapshot().rows).toBe(rows);
	});
	it("caps history and clears redo on a new transaction", async () => {
		const g = make({ historyLimit: 1 });
		await g.edit({ rowId: "a", columnId: "amount" }, "11");
		await g.edit({ rowId: "a", columnId: "amount" }, "12");
		await g.undo();
		expect(g.getSnapshot().canUndo).toBe(false);
		await g.edit({ rowId: "a", columnId: "amount" }, "13");
		expect(g.getSnapshot().canRedo).toBe(false);
	});
});
describe("interchange and persisted view", () => {
	it("roundtrips quoted tabs/newlines and Unicode", () => {
		const values = [["公司\t名称", "hello\nworld", '"quoted"', "😀"]];
		expect(parseDelimited(stringifyDelimited(values, "\t"))).toEqual(values);
		expect(() => parseDelimited('"unclosed')).toThrow();
	});
	it("neutralizes whitespace-prefixed CSV formula strings but preserves numeric negatives", () => {
		const g = make({
			rows: [{ ...rows[0], name: '  =HYPERLINK("x")', amount: -3 }],
		});
		expect(g.exportCSV()).toContain("'  =HYPERLINK");
		expect(g.exportCSV()).toContain(",-3,");
	});
	it("exports only loaded visible selected rows and visible columns", () => {
		const g = make();
		g.setColumn("date", { hidden: true });
		g.toggleRow("a");
		g.toggleRow("c");
		g.setState({ filters: { amount: "< 20" } });
		const out = parseDelimited(g.exportCSV(true), ",");
		expect(out).toHaveLength(2);
		expect(out[0]).toEqual(["Name", "Amount", "Region"]);
	});
	it("restores sanitized versioned view state without data or selection", () => {
		const g = make();
		g.setColumn("name", { width: 260, pinned: true });
		g.setState({ search: "Gamma" });
		g.select({ rowId: "c", columnId: "name" });
		const json = g.saveView();
		const other = make();
		expect(json).not.toContain("rowId");
		expect(other.restoreView(json)).toBe(true);
		expect(other.getSnapshot().viewRows[0]?.id).toBe("c");
		expect(other.restoreView('{"version":99}')).toBe(false);
		expect(other.restoreView("broken")).toBe(false);
	});
	it("validates dates, required fields and numeric expressions", async () => {
		expect(await validateCell("2023-02-29", rows[0], columns[3])).toBeTruthy();
		expect(
			await validateCell("2024-02-29", rows[0], columns[3]),
		).toBeUndefined();
		expect(await validateCell("", rows[0], columns[0])).toBeTruthy();
		expect(numericFilter("10..30")?.(20)).toBe(true);
		expect(numericFilter("oops")).toBeNull();
		expect(columnAddress(26)).toBe("AA");
	});
	it("isolates independent instances and subscriptions", async () => {
		const a = make();
		const b = make();
		const fn = mock();
		const off = a.subscribe(fn);
		off();
		await a.edit({ rowId: "a", columnId: "amount" }, "99");
		expect(b.getSnapshot().rows[0]?.amount).toBe(10);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe("column order boundaries", () => {
	it("reorders visible columns without moving hidden state or the other pin group", () => {
		const g = make();
		g.setColumn("amount", { hidden: true, width: 240 });
		g.setColumn("date", { pinned: true, width: 190 });
		const before = g.getSnapshot().state.columns;
		expect(g.reorderVisibleColumns(["region", "name"], false)).toBe(true);
		expect(g.getSnapshot().columns.map((column) => column.id)).toEqual([
			"date",
			"region",
			"name",
		]);
		expect(g.getSnapshot().state.columns.map((column) => column.id)).toEqual([
			"region",
			"amount",
			"name",
			"date",
		]);
		expect(g.getSnapshot().state.columns[1]).toBe(before[1]);
		expect(g.getSnapshot().state.columns[3]).toBe(before[3]);
		g.setColumn("amount", { hidden: false });
		expect(g.getSnapshot().columns.map((column) => column.id)).toEqual([
			"date",
			"region",
			"amount",
			"name",
		]);
		expect(g.getSnapshot().state.columns[1]?.width).toBe(240);
	});
	it("reorders pinned columns independently of normal and hidden columns", () => {
		const g = make();
		g.setColumn("name", { pinned: true });
		g.setColumn("date", { pinned: true });
		g.setColumn("amount", { hidden: true });
		expect(g.reorderVisibleColumns(["date", "name"], true)).toBe(true);
		expect(g.getSnapshot().columns.map((column) => column.id)).toEqual([
			"date",
			"name",
			"region",
		]);
		expect(g.getSnapshot().state.columns.map((column) => column.id)).toEqual([
			"date",
			"amount",
			"region",
			"name",
		]);
	});
	it("rejects incomplete, duplicate, hidden, unknown and cross-group permutations", () => {
		const g = make();
		g.setColumn("amount", { hidden: true });
		g.setColumn("date", { pinned: true });
		const before = g.getSnapshot();
		const changed = mock();
		const unsubscribe = g.subscribe(changed);
		for (const ids of [
			["region"],
			["name", "name"],
			["region", "amount"],
			["region", "missing"],
			["region", "date"],
			["date", "name", "region"],
		])
			expect(g.reorderVisibleColumns(ids, false)).toBe(false);
		expect(g.getSnapshot()).toBe(before);
		expect(changed).not.toHaveBeenCalled();
		unsubscribe();
	});
	it("menu movement skips hidden columns and stops at each pin boundary", () => {
		const g = make();
		g.setColumn("amount", { hidden: true });
		g.setColumn("date", { pinned: true });
		expect(g.canMoveColumn("name", -1)).toBe(false);
		expect(g.canMoveColumn("date", 1)).toBe(false);
		expect(g.canMoveColumn("region", 1)).toBe(false);
		expect(g.canMoveColumn("amount", 1)).toBe(false);
		expect(g.canMoveColumn("missing", 1)).toBe(false);
		expect(g.canMoveColumn("name", 1)).toBe(true);
		expect(g.moveColumn("name", 1)).toBe(true);
		expect(g.getSnapshot().state.columns.map((column) => column.id)).toEqual([
			"region",
			"amount",
			"name",
			"date",
		]);
		const before = g.getSnapshot();
		expect(g.moveColumn("region", -1)).toBe(false);
		expect(g.moveColumn("date", 1)).toBe(false);
		expect(g.moveColumn("amount", -1)).toBe(false);
		expect(g.moveColumn("missing", 1)).toBe(false);
		expect(g.getSnapshot()).toBe(before);
	});
	it("moves pinned columns and reevaluates boundaries after pin state changes", () => {
		const g = make();
		g.setColumn("name", { pinned: true });
		g.setColumn("region", { pinned: true });
		expect(g.canMoveColumn("name", 1)).toBe(true);
		expect(g.moveColumn("name", 1)).toBe(true);
		expect(g.getSnapshot().columns.map((column) => column.id)).toEqual([
			"region",
			"name",
			"amount",
			"date",
		]);
		expect(g.canMoveColumn("name", 1)).toBe(false);
		g.setColumn("name", { pinned: false });
		expect(g.canMoveColumn("name", 1)).toBe(true);
		expect(g.reorderVisibleColumns(["name", "region"], true)).toBe(false);
	});
	it("does not emit for an unchanged or empty visible group", () => {
		const g = make();
		const before = g.getSnapshot();
		expect(
			g.reorderVisibleColumns(["name", "amount", "region", "date"], false),
		).toBe(true);
		expect(g.reorderVisibleColumns([], true)).toBe(true);
		expect(g.getSnapshot()).toBe(before);
	});
	it("submits controlled reorder state without prematurely updating rendered columns", () => {
		const state = createGridState(columns);
		const changed = mock((_next: GridState, _reason: string) => {});
		const g = make({ state, onStateChange: changed });
		expect(
			g.reorderVisibleColumns(["date", "name", "amount", "region"], false),
		).toBe(true);
		expect(g.getSnapshot().state).toBe(state);
		const change = changed.mock.calls[0];
		if (!change) throw new Error("Expected a column state change");
		const [next, reason] = change;
		expect(reason).toBe("columns");
		g.updateOptions({ rows, columns, getRowId, state: next });
		expect(g.getSnapshot().columns.map((column) => column.id)).toEqual([
			"date",
			"name",
			"amount",
			"region",
		]);
	});
});

describe("extension and lifecycle contracts", () => {
	it("validates inserted rows atomically and supports undo", async () => {
		const g = make();
		expect(
			(await g.insertRows([{ ...rows[0], id: "d", amount: 101 }])).ok,
		).toBe(false);
		expect(
			(await g.insertRows([{ ...rows[0], id: "d", amount: 55 }], 1)).ok,
		).toBe(true);
		expect(g.getSnapshot().rows.map((r) => r.id)).toEqual(["a", "d", "b", "c"]);
		await g.undo();
		expect(g.getSnapshot().rows).toBe(rows);
		expect((await g.insertRows([rows[0]])).ok).toBe(false);
	});
	it("reorders only a complete valid column permutation", () => {
		const g = make();
		expect(g.reorderColumns(["amount", "name", "region", "date"])).toBe(true);
		expect(g.getSnapshot().columns[0]?.id).toBe("amount");
		expect(g.reorderColumns(["name", "name", "date", "region"])).toBe(false);
	});
	it("treats getter-only computed columns as read-only", async () => {
		const g = make({
			columns: [
				{
					id: "computed",
					header: "Computed",
					getValue: (r) => (r.amount ?? 0) * 2,
				},
			],
		});
		expect((await g.edit({ rowId: "a", columnId: "computed" }, "4")).ok).toBe(
			false,
		);
	});
	it("does not clear history for an equivalent inline row-ID getter", async () => {
		const g = make();
		await g.edit({ rowId: "a", columnId: "amount" }, "22");
		g.updateOptions({
			rows: g.getSnapshot().rows,
			columns,
			getRowId: (r) => r.id,
		});
		expect(g.getSnapshot().canUndo).toBe(true);
	});
	it("revokes pending writes when switched to read-only", async () => {
		let done!: () => void;
		const save = mock(
			() =>
				new Promise<void>((r) => {
					done = r;
				}),
		);
		const g = make({ onCommit: save });
		const result = g.edit({ rowId: "a", columnId: "amount" }, "22");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(save).toHaveBeenCalledTimes(1);
		g.updateOptions({
			rows,
			columns,
			getRowId,
			readOnly: true,
			onCommit: save,
		});
		done();
		expect((await result).ok).toBe(false);
		expect(g.getSnapshot().rows).toBe(rows);
	});
});

describe("controlled derived rows", () => {
	type CalculatedRow = {
		id: string;
		input: number;
		result: number;
		locked: boolean;
	};
	const calculatedColumns: Column<CalculatedRow>[] = [
		{
			id: "input",
			field: "input",
			header: "输入",
			type: "number",
			editable: (row) => !row.locked,
		},
		{
			id: "result",
			field: "result",
			header: "结果",
			type: "number",
			editable: false,
		},
	];
	const initial: [CalculatedRow] = [
		{ id: "a", input: 10, result: 20, locked: false },
	];
	const createCalculated = () =>
		createGrid({
			rows: initial,
			columns: calculatedColumns,
			getRowId: (row) => row.id,
			reconcileRows: "editable",
		});
	it("preserves cell history across derived echoes and exposes inverse patches", async () => {
		const grid = createCalculated();
		const notify = mock();
		grid.updateOptions({ ...grid.getOptions(), onRowsChange: notify });
		await grid.edit({ rowId: "a", columnId: "input" }, "12");
		grid.updateOptions({
			...grid.getOptions(),
			rows: [{ ...initial[0], input: 12, result: 24 }],
		});
		expect(grid.getSnapshot().canUndo).toBe(true);
		await grid.undo();
		expect(grid.getSnapshot().rows[0]).toMatchObject({ input: 10, result: 24 });
		expect(notify.mock.calls.at(-1)?.[1].patches).toEqual([
			{ rowId: "a", columnId: "input", value: 10 },
		]);
		grid.updateOptions({
			...grid.getOptions(),
			rows: [{ ...initial[0], result: 20 }],
		});
		expect(grid.getSnapshot().canRedo).toBe(true);
		await grid.redo();
		expect(grid.getSnapshot().rows[0]).toMatchObject({ input: 12, result: 20 });
		expect(notify.mock.calls.at(-1)?.[1].patches).toEqual([
			{ rowId: "a", columnId: "input", value: 12 },
		]);
	});
	it("clears history for a changed source value or row order", async () => {
		const grid = createCalculated();
		await grid.edit({ rowId: "a", columnId: "input" }, "12");
		grid.updateOptions({
			...grid.getOptions(),
			rows: [{ ...initial[0], input: 99, result: 198 }],
		});
		expect(grid.getSnapshot().canUndo).toBe(false);
		await grid.edit({ rowId: "a", columnId: "input" }, "13");
		grid.updateOptions({
			...grid.getOptions(),
			rows: [{ ...initial[0], id: "b", input: 13 }],
		});
		expect(grid.getSnapshot().canUndo).toBe(false);
	});
	it("does not mistake readonly toggles or newly locked changed inputs for an echo", async () => {
		const grid = createCalculated();
		await grid.edit({ rowId: "a", columnId: "input" }, "12");
		grid.updateOptions({
			...grid.getOptions(),
			readOnly: true,
			rows: [{ ...initial[0], input: 12, result: 24 }],
		});
		expect((await grid.undo()).ok).toBe(false);
		grid.updateOptions({ ...grid.getOptions(), readOnly: false });
		expect(grid.getSnapshot().canUndo).toBe(true);
		grid.updateOptions({
			...grid.getOptions(),
			rows: [{ ...initial[0], input: 99, locked: true }],
		});
		expect(grid.getSnapshot().canUndo).toBe(false);
	});
	it("retains the original external replacement reset unless explicitly enabled", async () => {
		const grid = createCalculated();
		grid.updateOptions({ ...grid.getOptions(), reconcileRows: undefined });
		await grid.edit({ rowId: "a", columnId: "input" }, "12");
		grid.updateOptions({
			...grid.getOptions(),
			rows: [{ ...initial[0], input: 12, result: 24 }],
		});
		expect(grid.getSnapshot().canUndo).toBe(false);
	});
});

describe("external data lifecycle", () => {
	it("marks external source replacements but not accepted commits or derived echoes", async () => {
		const grid = make({
			reconcileRows: "editable",
			columns: columns.map((column) =>
				column.id === "name" ? { ...column, editable: false } : column,
			),
		});
		const initialRevision = grid.getSnapshot().externalRevision;
		await grid.edit({ rowId: "a", columnId: "amount" }, "15");
		expect(grid.getSnapshot().externalRevision).toBe(initialRevision);
		grid.updateOptions({
			...grid.getOptions(),
			rows: grid
				.getSnapshot()
				.rows.map((row) => ({ ...row, name: `${row.name}!` })),
		});
		expect(grid.getSnapshot().externalRevision).toBe(initialRevision);
		grid.updateOptions({
			...grid.getOptions(),
			rows: grid.getSnapshot().rows.map((row) => ({ ...row, amount: 99 })),
		});
		expect(grid.getSnapshot().externalRevision).toBe(initialRevision + 1);
		grid.updateOptions({
			...grid.getOptions(),
			columns: [...grid.getOptions().columns],
		});
		expect(grid.getSnapshot().externalRevision).toBe(initialRevision + 2);
	});
	it.each([{ loading: true }, { error: "数据已失效" }])(
		"revokes pending writes when data becomes unavailable: %j",
		async (unavailable) => {
			let acknowledge: () => void = () => {};
			const persisted = mock(
				() =>
					new Promise<void>((resolve) => {
						acknowledge = resolve;
					}),
			);
			const grid = make({ onCommit: persisted });
			const pending = grid.edit({ rowId: "a", columnId: "amount" }, "15");
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(persisted).toHaveBeenCalledTimes(1);
			grid.updateOptions({ ...grid.getOptions(), ...unavailable });
			acknowledge();
			expect((await pending).ok).toBe(false);
			expect(grid.getSnapshot().rows).toBe(rows);
			expect(grid.getSnapshot().pending).toBe(false);
		},
	);
});

describe("default Chinese errors", () => {
	it("translates only built-in errors and column validation messages", () => {
		expect(formatGridError("This grid is read-only.")).toBe(
			"当前表格只读，不能修改。",
		);
		expect(formatGridError("销项税额 is read-only.")).toBe(
			"销项税额为只读列，不能修改。",
		);
		expect(formatGridError("金额: minimum -1.25.")).toBe(
			"金额：不能小于 -1.25。",
		);
		expect(formatGridError("Error: Unclosed quoted field.")).toBe(
			"粘贴内容中的引号未闭合，请检查后重试。",
		);
		expect(formatGridError("服务端版本冲突，请刷新后重试")).toBe(
			"服务端版本冲突，请刷新后重试",
		);
		expect(formatGridError("Error: Server rejected revision 42")).toBe(
			"Error: Server rejected revision 42",
		);
		expect(formatGridError("constructor")).toBe("constructor");
		expect(formatGridError("This grid is read-only.", "en-US")).toBe(
			"This grid is read-only.",
		);
	});
});
