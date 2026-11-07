/**
 * @file 搜索缓存的结果一致性、隔离与失效回归。
 * 创建时间：2026-11-07；修改时间：2026-11-07。
 * 被调用：bun test；调用：真实 GridStore 与未缓存的 deriveRows。
 * 预期结果：缓存减少重复格式化，编辑、历史、外部替换、列和语言变化不会返回旧结果。
 */
import { expect, it, mock } from "bun:test";
import { type Column, createGrid, type GridOptions } from "../src/core";
import { deriveRows } from "../src/core/data";

type Row = { id: string; name: string; amount: number; note: string };
const rows: Row[] = [
	{ id: "a", name: "İSTANBUL", amount: 1000, note: "abc" },
	{ id: "b", name: "Alpha", amount: 20, note: "def" },
];
const columns: Column<Row>[] = [
	{ id: "name", field: "name", header: "名称" },
	{
		id: "amount",
		field: "amount",
		header: "金额",
		type: "number",
		format: (value, _row, locale) =>
			`${Number(value).toLocaleString(locale)} 元`,
	},
	{ id: "note", field: "note", header: "备注", hidden: true },
];
const options: GridOptions<Row> = {
	rows,
	columns,
	getRowId: (row) => row.id,
	locale: "zh-CN",
};

it("保留原值/显示文本、隐藏列、语言和组合筛选排序的搜索结果", () => {
	for (const locale of ["zh-CN", "tr-TR", "en-US"]) {
		const grid = createGrid({ ...options, locale });
		for (const query of [
			"xyz",
			"1,000",
			"1000",
			"元",
			"abc",
			"1000abc",
			"İSTANBUL",
			"istanbul",
			"ALPHA",
			"",
			"20",
		]) {
			grid.setState({
				search: query,
				filters: { amount: ">= 20" },
				sorting: [{ id: "name", direction: "desc" }],
			});
			const snapshot = grid.getSnapshot();
			expect(snapshot.viewRows).toEqual(
				deriveRows(rows, columns, snapshot.state, locale),
			);
		}
	}
});

it("连续搜索复用格式化文本，列或语言更换后立即失效", () => {
	const format = mock(
		(value: unknown, _row: Row, locale: string) => `${locale}:${value}`,
	);
	const schema = columns.map((column) =>
		column.id === "amount" ? { ...column, format } : column,
	);
	const grid = createGrid({ ...options, columns: schema });
	grid.setState({ search: "missing" });
	expect(format).toHaveBeenCalledTimes(2);
	grid.setState({ search: "missing-again" });
	expect(format).toHaveBeenCalledTimes(2);
	grid.setState({ search: "zh-cn:1000" });
	expect(grid.getSnapshot().viewRows.map((row) => row.id)).toEqual(["a"]);
	grid.updateOptions({ ...options, columns: schema, locale: "en-US" });
	expect(grid.getSnapshot().viewRows).toHaveLength(0);
	expect(format).toHaveBeenCalledTimes(4);
	grid.updateOptions({
		...options,
		columns: schema.map((column) =>
			column.id === "amount"
				? { ...column, format: () => "zh-cn:1000" }
				: column,
		),
	});
	expect(grid.getSnapshot().viewRows).toHaveLength(2);
});

it("编辑、撤销重做及同 ID 外部替换使用最新数据，实例之间互不污染", async () => {
	const grid = createGrid(options);
	grid.setState({ search: "1000" });
	expect(grid.getSnapshot().viewRows.map((row) => row.id)).toEqual(["a"]);
	await grid.edit({ rowId: "a", columnId: "amount" }, "2000");
	expect(grid.getSnapshot().viewRows).toHaveLength(0);
	await grid.undo();
	expect(grid.getSnapshot().viewRows.map((row) => row.id)).toEqual(["a"]);
	await grid.redo();
	expect(grid.getSnapshot().viewRows).toHaveLength(0);
	const other = createGrid(options);
	other.setState({ search: "1000" });
	expect(other.getSnapshot().viewRows.map((row) => row.id)).toEqual(["a"]);
	grid.updateOptions({
		...options,
		rows: rows.map((row) => ({ ...row, amount: 1000 })),
	});
	expect(grid.getSnapshot().viewRows).toHaveLength(2);
	grid.updateOptions({ ...options, rows: [] });
	expect(grid.getSnapshot().viewRows).toHaveLength(0);
});
