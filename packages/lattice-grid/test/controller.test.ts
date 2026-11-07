/**
 * @file 编辑控制器的权限、复制选区和异步提交生命周期回归。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 被调用：bun test；调用：真实 GridStore 与 GridView 的无 DOM 数据订阅。
 * 预期结果：失效草稿及时退出，自己的提交和派生回写不中断编辑，新会话不被旧请求关闭。
 */
import { describe, expect, it } from "bun:test";
import { type Column, createGrid, type GridOptions } from "../src/core";
import { GridView } from "../src/view-controller";

type Row = { id: string; value: number; calculated: number; locked: boolean };
const columns: Column<Row>[] = [
	{
		id: "value",
		field: "value",
		header: "金额",
		type: "number",
		editable: (row) => !row.locked,
	},
	{
		id: "calculated",
		field: "calculated",
		header: "计算结果",
		type: "number",
		editable: false,
	},
];
const position = { rowId: "a", columnId: "value" };

describe("selection without data changes", () => {
	function fixture(overrides: Partial<GridOptions<Row>> = {}) {
		const store = createGrid<Row>({
			rows: [
				{ id: "a", value: 1, calculated: 10, locked: false },
				{ id: "b", value: 2, calculated: 20, locked: false },
			],
			columns,
			getRowId: (row) => row.id,
			...overrides,
		});
		return { store, view: new GridView(store, { id: "selection-grid" }) };
	}

	it("keeps readonly values selectable and copyable", () => {
		const { store, view } = fixture();
		const source = { rowId: "a", columnId: "calculated" };
		view.select(source);
		expect(store.getSnapshot().state.selection?.focus).toEqual(source);
		expect(store.copySelection()).toBe("10");
		expect(store.getSnapshot().rows.map((row) => row.value)).toEqual([1, 2]);
	});

	it("copies mixed ranges without changing their values", () => {
		const { store } = fixture();
		store.select({ rowId: "a", columnId: "calculated" });
		store.select({ rowId: "b", columnId: "value" }, true);
		expect(store.copySelection()).toBe("1\t10\r\n2\t20");
		expect(store.getSnapshot().rows.map((row) => row.value)).toEqual([1, 2]);
	});
});

function setup(overrides: Partial<GridOptions<Row>> = {}) {
	let options: GridOptions<Row> = {
		rows: [{ id: "a", value: 1, calculated: 10, locked: false }],
		columns,
		getRowId: (row) => row.id,
		...overrides,
	};
	const store = createGrid(options);
	const view = new GridView(store, { id: "test-grid" });
	const cleanup = view.mount();
	const update = (patch: Partial<GridOptions<Row>>) => {
		options = { ...options, ...patch };
		store.updateOptions(options);
	};
	view.startEdit(position, "25");
	return { store, view, cleanup, update };
}

describe("editor lifecycle", () => {
	it("keeps the current value on entry and creates no transaction when it is unchanged", async () => {
		let changes = 0;
		const fixture = setup({
			onRowsChange: () => {
				changes++;
			},
		});
		try {
			fixture.view.startEdit(position);
			expect(fixture.view.getSnapshot().draft).toBe("1");
			expect(await fixture.view.commitEdit()).toBe(true);
			fixture.view.startEdit(position);
			expect(await fixture.view.leaveEdit()).toBe(true);
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(changes).toBe(0);
			expect(fixture.store.getSnapshot().canUndo).toBe(false);
		} finally {
			fixture.cleanup();
		}
	});

	it("formats the editor without converting an absent amount into a saved zero", async () => {
		const store = createGrid({
			rows: [{ id: "a", amount: "" }],
			getRowId: (row) => row.id,
			columns: [
				{
					id: "amount",
					field: "amount",
					header: "金额",
					formatEdit: (value) => String(value || "0.00"),
				},
			],
		});
		const view = new GridView(store, { id: "formatted-grid" });
		const cleanup = view.mount();
		try {
			view.startEdit({ rowId: "a", columnId: "amount" });
			expect(view.getSnapshot().draft).toBe("0.00");
			expect(await view.leaveEdit()).toBe(true);
			expect(store.getSnapshot().rows[0]?.amount).toBe("");
			expect(store.getSnapshot().canUndo).toBe(false);
			view.startEdit({ rowId: "a", columnId: "amount" }, "2");
			expect(await view.commitEdit()).toBe(true);
			expect(store.getSnapshot().rows[0]?.amount).toBe("2");
		} finally {
			cleanup();
		}
	});

	it("closes on leaving before async saving finishes and does not reclaim focus", async () => {
		const release = Promise.withResolvers<void>();
		const fixture = setup({ onCommit: () => release.promise });
		let focusCalls = 0;
		fixture.view.focusGrid = () => {
			focusCalls++;
		};
		try {
			const result = fixture.view.leaveEdit();
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(fixture.store.getSnapshot().pending).toBe(true);
			release.resolve();
			expect(await result).toBe(true);
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(25);
			expect(fixture.store.getSnapshot().canUndo).toBe(true);
			expect(focusCalls).toBe(0);
		} finally {
			release.resolve();
			fixture.cleanup();
		}
	});

	it("rejects invalid edits on leaving without reopening or overwriting the previous value", async () => {
		const fixture = setup();
		try {
			fixture.view.set({ draft: "invalid number" });
			expect(await fixture.view.leaveEdit()).toBe(false);
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(1);
			expect(fixture.store.getSnapshot().error).not.toBe("");
			expect(fixture.store.getSnapshot().canUndo).toBe(false);
		} finally {
			fixture.cleanup();
		}
	});

	it("does not repeat a pending explicit save or refocus when leaving it", async () => {
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		let commits = 0;
		let focusCalls = 0;
		const fixture = setup({
			onCommit: async () => {
				commits++;
				started.resolve();
				await release.promise;
			},
		});
		fixture.view.focusGrid = () => {
			focusCalls++;
		};
		try {
			const result = fixture.view.commitEdit();
			await started.promise;
			expect(await fixture.view.leaveEdit()).toBe(true);
			release.resolve();
			expect(await result).toBe(false);
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(25);
			expect(commits).toBe(1);
			expect(focusCalls).toBe(0);
		} finally {
			release.resolve();
			fixture.cleanup();
		}
	});

	it("cancels a changed draft without submitting it", () => {
		const fixture = setup();
		try {
			fixture.view.cancelEdit();
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(1);
			expect(fixture.store.getSnapshot().canUndo).toBe(false);
		} finally {
			fixture.cleanup();
		}
	});

	for (const patch of [
		{ readOnly: true },
		{ loading: true },
		{ error: "加载失败" },
	]) {
		it(`closes a draft when host becomes unavailable: ${Object.keys(patch)[0]}`, () => {
			const fixture = setup();
			try {
				fixture.update(patch);
				expect(fixture.view.getSnapshot().editing).toBeNull();
				expect(fixture.view.getSnapshot().draft).toBe("");
				expect(fixture.store.getSnapshot().rows[0]?.value).toBe(1);
			} finally {
				fixture.cleanup();
			}
		});
	}

	it("discards an old draft when the host replaces source values with the same row IDs", () => {
		const fixture = setup();
		try {
			fixture.update({
				rows: [{ id: "a", value: 8, calculated: 80, locked: false }],
			});
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(8);
		} finally {
			fixture.cleanup();
		}
	});

	it("preserves an in-progress draft across readonly derived-value refreshes", () => {
		const fixture = setup({ reconcileRows: "editable" });
		try {
			fixture.update({
				rows: [{ id: "a", value: 1, calculated: 99, locked: false }],
			});
			expect(fixture.view.getSnapshot().editing).toEqual(position);
			expect(fixture.view.getSnapshot().draft).toBe("25");
		} finally {
			fixture.cleanup();
		}
	});

	it("closes an editor when row-level editability changes in a derived refresh", () => {
		const fixture = setup({ reconcileRows: "editable" });
		try {
			fixture.update({
				rows: [{ id: "a", value: 1, calculated: 10, locked: true }],
			});
			expect(fixture.view.getSnapshot().editing).toBeNull();
		} finally {
			fixture.cleanup();
		}
	});

	it("closes an editor when its column becomes hidden or is removed", () => {
		for (const remove of [false, true]) {
			const fixture = setup();
			try {
				if (remove)
					fixture.update({
						columns: columns.filter((column) => column.id !== "value"),
					});
				else fixture.store.setColumn("value", { hidden: true });
				expect(fixture.view.getSnapshot().editing).toBeNull();
			} finally {
				fixture.cleanup();
			}
		}
	});

	it("keeps its editor during an accepted pending commit and the host's derived echo", async () => {
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const fixture = setup({
			reconcileRows: "editable",
			onCommit: async () => {
				started.resolve();
				await release.promise;
			},
		});
		fixture.update({
			onRowsChange: (rows) =>
				fixture.update({
					rows: rows.map((row) => ({ ...row, calculated: row.value * 10 })),
				}),
		});
		try {
			const committed = fixture.view.commitEdit();
			await started.promise;
			expect(fixture.view.getSnapshot().editing).toEqual(position);
			release.resolve();
			expect(await committed).toBe(true);
			expect(fixture.view.getSnapshot().editing).toBeNull();
			expect(fixture.store.getSnapshot().rows[0]).toMatchObject({
				value: 25,
				calculated: 250,
			});
		} finally {
			release.resolve();
			fixture.cleanup();
		}
	});

	it("keeps an unsuccessful draft available for correction", async () => {
		const fixture = setup({
			onCommit: () => {
				throw new Error("保存失败");
			},
		});
		try {
			expect(await fixture.view.commitEdit()).toBe(false);
			expect(fixture.view.getSnapshot().editing).toEqual(position);
			expect(fixture.view.getSnapshot().draft).toBe("25");
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(1);
		} finally {
			fixture.cleanup();
		}
	});

	it("an invalidated old request cannot close a newly opened editor", async () => {
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const fixture = setup({
			onCommit: async () => {
				started.resolve();
				await release.promise;
			},
		});
		try {
			const previousCommit = fixture.view.commitEdit();
			await started.promise;
			fixture.update({
				rows: [{ id: "a", value: 8, calculated: 80, locked: false }],
			});
			fixture.view.startEdit(position, "90");
			release.resolve();
			expect(await previousCommit).toBe(false);
			expect(fixture.view.getSnapshot().editing).toEqual(position);
			expect(fixture.view.getSnapshot().draft).toBe("90");
			expect(fixture.store.getSnapshot().rows[0]?.value).toBe(8);
		} finally {
			release.resolve();
			fixture.cleanup();
		}
	});
});
