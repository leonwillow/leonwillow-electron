/**
 * @file 表头缓存对选择、列结构与数据更新的回归验证。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：使用真实 Store 状态变化验证可见列引用与 React memo 更新边界。
 * 被调用：bun test；调用：GridStore、GridHeader 与 GridView。
 * 预期结果：同列内拖选跳过表头更新，筛选、排序、全选与自动列宽数据仍及时更新。
 */
import { describe, expect, it } from "bun:test";
import {
	type Column,
	createGrid,
	createGridState,
	type GridOptions,
	selectionBounds,
} from "../src/core";
import { zhCN } from "../src/core/messages";
import { GridHeader } from "../src/grid-header";
import { selectionColumns } from "../src/selection-outline";
import { GridView } from "../src/view-controller";

type Row = { id: string; name: string; amount: number; category: string };
type HeaderProps = Parameters<typeof GridHeader<Row>>[0];

// 直接验证组件正在使用的 memo 边界，不另建与生产实现平行的比较函数。
const sameHeader = (
	GridHeader as unknown as {
		compare: (before: HeaderProps, after: HeaderProps) => boolean;
	}
).compare;

function fixture(mode?: GridOptions<Row>["mode"]) {
	const rows: readonly Row[] = [
		{ id: "a", name: "第一行", amount: 1, category: "甲" },
		{ id: "b", name: "第二行", amount: 2, category: "乙" },
		{ id: "c", name: "第三行", amount: 3, category: "甲" },
	];
	const columns: readonly Column<Row>[] = [
		{ id: "name", field: "name", header: "名称" },
		{ id: "amount", field: "amount", header: "金额", type: "number" },
		{
			id: "category",
			field: "category",
			header: "类别",
			options: ["甲", "乙"],
		},
	];
	const store = createGrid({ rows, columns, getRowId: (row) => row.id, mode });
	const view = new GridView(store, { id: "header-cache", messages: zhCN });
	const drag: HeaderProps["drag"] = {
		start() {},
		end() {},
		dropAnimation: null,
		marker: () => undefined,
	};
	const props = (): HeaderProps => {
		const snapshot = store.getSnapshot();
		const selectedRows = new Set(snapshot.state.selectedRows);
		return {
			view,
			snapshot,
			layout: view.layout(),
			selectedColumns: selectionColumns(
				selectionBounds(
					snapshot.state,
					snapshot.viewRows,
					snapshot.columns,
					store.getOptions().getRowId,
				),
				snapshot.columns.length,
			),
			drag,
			headHeight: 68,
			headerHeight: 36,
			groupHeaderHeight: 0,
			filterHeight: 32,
			groupStickyLeft: 44,
			showFilters: true,
			visibleSelected: snapshot.viewRows.filter((row) =>
				selectedRows.has(row.id),
			).length,
			selectAllLabel: "全选",
			resizeLabel: "调整列宽",
			locale: "zh-CN",
		};
	};
	return { store, props };
}

describe("可见列缓存", () => {
	it("单区、多区和行选择以及行数据派生不重建可见列", () => {
		const { store } = fixture();
		const columns = store.getSnapshot().columns;
		const unchanged = () => expect(store.getSnapshot().columns).toBe(columns);
		store.select({ rowId: "a", columnId: "name" });
		unchanged();
		store.select({ rowId: "c", columnId: "amount" }, true);
		unchanged();
		store.select({ rowId: "b", columnId: "category" }, false, true);
		unchanged();
		store.toggleRow("b");
		unchanged();
		store.setState({ search: "第一" }, "search");
		unchanged();
		store.setState({ filters: { amount: ">= 1" } }, "filters");
		unchanged();
		store.sort("amount", false, "desc");
		unchanged();
		store.updateOptions({
			...store.getOptions(),
			rows: store
				.getSnapshot()
				.rows.map((row) => ({ ...row, amount: row.amount + 1 })),
		});
		unchanged();
	});

	it("隐藏、冻结和拖动排序及时改变顺序，后续选择复用新结果", () => {
		const { store } = fixture();
		const ids = () => store.getSnapshot().columns.map((column) => column.id);
		store.setColumn("amount", { hidden: true });
		expect(ids()).toEqual(["name", "category"]);
		store.setColumn("category", { pinned: true });
		expect(ids()).toEqual(["category", "name"]);
		store.setColumn("amount", { hidden: false });
		expect(ids()).toEqual(["category", "name", "amount"]);
		expect(store.reorderVisibleColumns(["amount", "name"], false)).toBe(true);
		expect(ids()).toEqual(["category", "amount", "name"]);
		const reordered = store.getSnapshot().columns;
		store.select({ rowId: "c", columnId: "amount" });
		expect(store.getSnapshot().columns).toBe(reordered);
	});

	it("源列定义替换和受控列状态不会沿用过期对象", () => {
		const { store } = fixture();
		const source = store.getOptions().columns;
		const state = createGridState(source);
		store.updateOptions({ ...store.getOptions(), state });
		const before = store.getSnapshot().columns;
		store.updateOptions({
			...store.getOptions(),
			state: { ...state, selectedRows: ["a"] },
		});
		expect(store.getSnapshot().columns).toBe(before);
		store.updateOptions({
			...store.getOptions(),
			state: {
				...state,
				columns: [...state.columns]
					.reverse()
					.map((column) => ({ ...column, hidden: column.id === "amount" })),
			},
		});
		expect(store.getSnapshot().columns.map((column) => column.id)).toEqual([
			"category",
			"name",
		]);
		const replacement = source.map((column) => ({
			...column,
			header: `新${column.header}`,
		}));
		store.updateOptions({ ...store.getOptions(), columns: replacement });
		expect(store.getSnapshot().columns[0]).toBe(replacement[2]);
		expect(store.getSnapshot().columns[1]?.header).toBe("新名称");
	});
});

describe("表头实际更新边界", () => {
	it("纵向扩选和同列追加区域跳过更新，横向范围与取消选择更新高亮", () => {
		const { store, props } = fixture();
		store.select({ rowId: "a", columnId: "name" });
		const initial = props();
		store.select({ rowId: "b", columnId: "name" }, true);
		const vertical = props();
		expect(vertical.snapshot).not.toBe(initial.snapshot);
		expect(vertical.selectedColumns).not.toBe(initial.selectedColumns);
		expect(sameHeader(initial, vertical)).toBe(true);
		store.select({ rowId: "c", columnId: "name" }, false, true);
		expect(sameHeader(vertical, props())).toBe(true);
		store.select({ rowId: "c", columnId: "amount" }, true);
		const horizontal = props();
		expect(sameHeader(vertical, horizontal)).toBe(false);
		store.clearSelection();
		expect(sameHeader(horizontal, props())).toBe(false);
	});

	it("服务端行未变化时，筛选值与排序标记仍触发表头更新", () => {
		const { store, props } = fixture("server");
		const initial = props();
		store.setState({ filters: { category: ["甲"] } }, "filters");
		const filtered = props();
		expect(filtered.snapshot.viewRows).toBe(initial.snapshot.viewRows);
		expect(sameHeader(initial, filtered)).toBe(false);
		store.sort("amount", false, "desc");
		const sorted = props();
		expect(sorted.snapshot.viewRows).toBe(filtered.snapshot.viewRows);
		expect(sameHeader(filtered, sorted)).toBe(false);
	});

	it("全选复选框及相同行数的新数据更新，避免自动列宽使用旧内容", () => {
		const { store, props } = fixture();
		const initial = props();
		store.toggleRow("a");
		const partial = props();
		expect(sameHeader(initial, partial)).toBe(false);
		store.toggleAll();
		const all = props();
		expect(sameHeader(partial, all)).toBe(false);
		store.updateOptions({
			...store.getOptions(),
			rows: store
				.getSnapshot()
				.rows.map((row) => ({ ...row, name: `${row.name}新增的较长内容` })),
		});
		const changed = props();
		expect(changed.snapshot.viewRows.length).toBe(all.snapshot.viewRows.length);
		expect(sameHeader(all, changed)).toBe(false);
	});

	it("列宽、显示、冻结及布局和拖动反馈更新不被缓存阻挡", () => {
		const { store, props } = fixture();
		for (const patch of [
			{ width: 240 },
			{ hidden: true },
			{ hidden: false, pinned: true },
		]) {
			const before = props();
			store.setColumn("amount", patch);
			expect(sameHeader(before, props())).toBe(false);
		}
		const before = props();
		for (const patch of [
			{ groupStickyLeft: before.groupStickyLeft + 20 },
			{ headerHeight: before.headerHeight + 4 },
			{ showFilters: false },
			{ locale: "en-US" },
			{ drag: { ...before.drag, marker: () => "odd" as const } },
		])
			expect(sameHeader(before, { ...before, ...patch })).toBe(false);
	});
});
