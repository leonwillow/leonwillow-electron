/**
 * @file VAT 四项调整与通用 Grid 的金额、事务及汇总回归。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：验证调增/调减分别保留原值，批量编辑、筛选和汇总沿用整数分规则。
 * 被调用：Web Bun 测试；调用：VAT 列适配、共享表格内核和计税包。
 * 预期结果：四项非负输入原子提交，撤销后恢复完整原值，余额不重复累加。
 */
import { expect, test } from "bun:test";
import {
	type Adjustments,
	adjustmentFields,
	calculate,
	changed,
	emptyAdjustment,
	type HistoryRow,
} from "@leonwillow-electron/calculators";
import {
	aggregate,
	createGrid,
	type GridOptions,
} from "@leonwillow-electron/lattice-grid/core";
import {
	applyVatGridChanges,
	parseVatAdjustment,
	type VatGridRow,
	vatAdjustmentGridFields,
	vatGridChanges,
	vatGridColumns,
	vatGridRowId,
	vatGridRows,
} from "../src/views/calculators/vat-grid-model";

const month = (date: string): HistoryRow => ({
	month: date,
	x: "200.00",
	i: "100.00",
	t: "0.00",
	tax: "100.00",
	end: "0.00",
});
const adjustment = (
	values: Partial<Adjustments[string]> = {},
): Adjustments[string] => ({ ...emptyAdjustment(), ...values });
const rowsFor = (history: HistoryRow[], adjustments: Adjustments = {}) =>
	vatGridRows(calculate(history, adjustments).rows, adjustments);
function summary(columnId: string, rows: readonly VatGridRow[]) {
	const column = vatGridColumns.find((candidate) => candidate.id === columnId);
	if (!column) throw Error(`缺少汇总列 ${columnId}`);
	return aggregate(rows, column);
}

test("四项调整分别保留整数分精度，拒绝任何负数或第三位小数", () => {
	for (const key of adjustmentFields) {
		expect(parseVatAdjustment("9,999,999,999.99", key)).toBe("9999999999.99");
		expect(parseVatAdjustment(".01", key)).toBe("0.01");
		expect(parseVatAdjustment("", key)).toBe("");
		expect(() => parseVatAdjustment("-0.01", key)).toThrow("不能为负数");
		expect(() => parseVatAdjustment("0.001", key)).toThrow("最多两位小数");
	}
});

test("只有四项调整列可编辑，缺月、原历史和联动结果只读", () => {
	const rows = rowsFor([month("2026-01"), month("2026-03")]);
	const editable = vatGridColumns.filter((column) => column.editable !== false);
	expect(editable.map((column) => column.id)).toEqual([...adjustmentFields]);
	expect(editable.map((column) => column.group)).toEqual([
		"销项调整",
		"销项调整",
		"进项调整",
		"进项调整",
	]);
	const [existing, gap] = rows;
	if (!existing || !gap) throw Error("测试月份缺失");
	for (const column of editable) {
		if (typeof column.editable !== "function")
			throw Error("调整列必须按行判断");
		expect(column.editable(existing)).toBe(true);
		expect(column.editable(gap)).toBe(false);
	}
});

test("批量修改保留同月其他三项和其他月份，反向快照恢复四项原值", () => {
	const adjustments = {
		"2026-01": adjustment({
			outputIncrease: "5.00",
			outputDecrease: "2.00",
			inputIncrease: "1.00",
			inputDecrease: "3.00",
		}),
		"2026-02": adjustment({ outputIncrease: "3.00", inputDecrease: "4.00" }),
		"2026-03": adjustment({ outputIncrease: "9.00", inputIncrease: "4.00" }),
	};
	const previous = rowsFor([month("2026-01"), month("2026-02")], adjustments);
	const next = previous.map((row) =>
		row.month === "2026-01"
			? {
					...row,
					adjustmentOutputIncrease: "10.00",
					adjustmentInputDecrease: "2.00",
				}
			: { ...row, adjustmentOutputDecrease: "20.00" },
	);
	const changes = vatGridChanges(previous, next);
	expect(changes).toHaveLength(3);
	const applied = applyVatGridChanges(adjustments, changes);
	expect(applied).toEqual({
		"2026-01": adjustment({
			outputIncrease: "10.00",
			outputDecrease: "2.00",
			inputIncrease: "1.00",
			inputDecrease: "2.00",
		}),
		"2026-02": adjustment({
			outputIncrease: "3.00",
			outputDecrease: "20.00",
			inputDecrease: "4.00",
		}),
		"2026-03": adjustments["2026-03"],
	});
	expect(adjustments["2026-01"].outputIncrease).toBe("5.00");
	expect(applyVatGridChanges(applied, vatGridChanges(next, previous))).toEqual(
		adjustments,
	);
});

test("派生结果重算和缺月数据不会回写四项调整", () => {
	const previous = rowsFor([month("2026-01"), month("2026-03")]);
	const next = previous.map((row) => ({
		...row,
		delta: 400,
		adjustmentOutputIncrease: row.h ? row.adjustmentOutputIncrease : "99.00",
	}));
	expect(vatGridChanges(previous, next)).toEqual([]);
});

test("两个月四列粘贴每批只更新一次方案，联动重算后撤销和重做恢复完整毛额", async () => {
	const history = [month("2026-01"), month("2026-02")];
	let adjustments: Adjustments = {};
	let changes = 0;
	const options = (): GridOptions<VatGridRow> => ({
		rows: rowsFor(history, adjustments),
		columns: vatGridColumns,
		getRowId: vatGridRowId,
		reconcileRows: "editable",
		onRowsChange: (next, transaction) => {
			changes++;
			adjustments = applyVatGridChanges(
				adjustments,
				vatGridChanges(transaction.previousRows, next),
			);
		},
	});
	const grid = createGrid(options());
	grid.select({ rowId: "2026-01", columnId: "outputIncrease" });
	expect(
		(
			await grid.paste([
				["50.25", "20.00", "10.00", "2.00"],
				["20.00", "5.00", "0.25", "3.00"],
			])
		).ok,
	).toBe(true);
	expect(changes).toBe(1);
	const entered = {
		"2026-01": adjustment({
			outputIncrease: "50.25",
			outputDecrease: "20.00",
			inputIncrease: "10.00",
			inputDecrease: "2.00",
		}),
		"2026-02": adjustment({
			outputIncrease: "20.00",
			outputDecrease: "5.00",
			inputIncrease: "0.25",
			inputDecrease: "3.00",
		}),
	};
	expect(adjustments).toEqual(entered);
	grid.updateOptions(options());
	expect(grid.getSnapshot().rows[0]?.n?.tax).toBe(12225);
	expect(grid.getSnapshot().rows[1]?.n?.tax).toBe(11775);
	expect(summary("result-tax", grid.getSnapshot().viewRows)).toBe(24000);
	expect(grid.getSnapshot().canUndo).toBe(true);
	expect((await grid.undo()).ok).toBe(true);
	expect(changes).toBe(2);
	expect(adjustments).toEqual({
		"2026-01": emptyAdjustment(),
		"2026-02": emptyAdjustment(),
	});
	grid.updateOptions(options());
	expect(summary("result-tax", grid.getSnapshot().viewRows)).toBe(20000);
	expect(grid.getSnapshot().canRedo).toBe(true);
	expect((await grid.redo()).ok).toBe(true);
	expect(changes).toBe(3);
	expect(adjustments).toEqual(entered);
	grid.updateOptions(options());
	expect(summary("result-tax", grid.getSnapshot().viewRows)).toBe(24000);
});

test("任一调增或调减为负数时整批拒绝，缺月同样不允许部分粘贴", async () => {
	let changes = 0;
	const grid = createGrid({
		rows: rowsFor([month("2026-01"), month("2026-03")]),
		columns: vatGridColumns,
		getRowId: vatGridRowId,
		onRowsChange: () => {
			changes++;
		},
	});
	grid.select({ rowId: "2026-01", columnId: "outputIncrease" });
	for (let invalid = 0; invalid < adjustmentFields.length; invalid++)
		expect(
			(
				await grid.paste([
					adjustmentFields.map((_, index) =>
						index === invalid ? "-0.01" : "50.00",
					),
				])
			).ok,
		).toBe(false);
	expect((await grid.paste([["50.00"], ["10.00"]])).ok).toBe(false);
	expect(changes).toBe(0);
	for (const key of adjustmentFields)
		expect(grid.getSnapshot().rows[0]?.[vatAdjustmentGridFields[key]]).toBe("");
	expect(grid.getSnapshot().canUndo).toBe(false);
});

test("相等调增和调减仍保留四项原值、四项汇总且不会被仅看调整筛选隐藏", () => {
	const adjustments = {
		"2026-01": adjustment({
			outputIncrease: "10.00",
			outputDecrease: "10.00",
			inputIncrease: "5.00",
			inputDecrease: "5.00",
		}),
	};
	const rows = rowsFor([month("2026-01")], adjustments);
	expect(rows[0]?.delta).toBe(0);
	expect(rows.filter(changed)).toHaveLength(1);
	expect(adjustmentFields.map((key) => summary(key, rows))).toEqual([
		1000, 1000, 500, 500,
	]);
	expect(rows[0]?.adjustmentOutputIncrease).toBe("10.00");
	expect(rows[0]?.adjustmentOutputDecrease).toBe("10.00");
	expect(rows[0]?.adjustmentInputIncrease).toBe("5.00");
	expect(rows[0]?.adjustmentInputDecrease).toBe("5.00");
});

test("历史金额复制及筛选使用元单位，复制后可准确粘贴到任一调整列", async () => {
	const grid = createGrid({
		rows: rowsFor([month("2026-01")]),
		columns: vatGridColumns,
		getRowId: vatGridRowId,
	});
	grid.select({ rowId: "2026-01", columnId: "history-x" });
	const copied = grid.copySelection();
	expect(copied).toBe("200.00");
	for (const key of adjustmentFields) {
		grid.select({ rowId: "2026-01", columnId: key });
		expect((await grid.paste([[copied]])).ok).toBe(true);
		expect(grid.getSnapshot().rows[0]?.[vatAdjustmentGridFields[key]]).toBe(
			"200.00",
		);
	}
	grid.setState({ filters: { "history-x": "> 200" } });
	expect(grid.getSnapshot().viewRows).toHaveLength(0);
	grid.setState({ filters: { "history-x": ">= 200" } });
	expect(grid.getSnapshot().viewRows).toHaveLength(1);
	grid.select({ rowId: "2026-01", columnId: "result-tax" });
	expect(grid.copySelection()).toBe("100.00");
});

test("联动金额可超过单笔录入上限，显示与复制保持完整元金额", () => {
	const history = [
		{
			...month("2026-01"),
			x: "9999999999.99",
			i: "0.00",
			tax: "9999999999.99",
		},
	];
	const adjustments = {
		"2026-01": adjustment({ outputIncrease: "9999999999.99" }),
	};
	const row = rowsFor(history, adjustments)[0];
	const column = vatGridColumns.find(
		(candidate) => candidate.id === "result-tax",
	);
	if (!row || !column) throw Error("测试金额列缺失");
	expect(column.getValue?.(row)).toBe("19999999999.98");
	expect(column.format?.(column.getValue?.(row), row, "zh-CN")).toBe(
		"19,999,999,999.98",
	);
});

test("四项调整均按数值排序与元值筛选，空调整视为零", () => {
	const amounts = ["2.05", "0.10", "10.00", "", "0.01", "2.50"];
	const history = amounts.map((_, index) => month(`2026-0${index + 1}`));
	for (const key of adjustmentFields) {
		const adjustments = Object.fromEntries(
			history.map((row, index) => [
				row.month,
				adjustment({ [key]: amounts[index] ?? "" }),
			]),
		);
		const grid = createGrid({
			rows: rowsFor(history, adjustments),
			columns: vatGridColumns,
			getRowId: vatGridRowId,
		});
		const values = () =>
			grid
				.getSnapshot()
				.viewRows.map((row) => row[vatAdjustmentGridFields[key]]);
		grid.sort(key, false, "asc");
		expect(values()).toEqual(["", "0.01", "0.10", "2.05", "2.50", "10.00"]);
		grid.sort(key, false, "desc");
		expect(values()).toEqual(["10.00", "2.50", "2.05", "0.10", "0.01", ""]);
		grid.setState({ filters: { [key]: "0.01..0.10" } });
		expect(values()).toEqual(["0.10", "0.01"]);
		grid.setState({ filters: { [key]: "= 0" } });
		expect(values()).toEqual([""]);
	}
});

test("四项毛额分别精确汇总，调减通过净变化形成负值", () => {
	const adjustments = {
		"2026-01": adjustment({ outputDecrease: "0.10", inputIncrease: "0.20" }),
		"2026-02": adjustment({
			outputIncrease: "0.30",
			inputIncrease: "0.20",
			inputDecrease: "0.10",
		}),
	};
	const rows = rowsFor([month("2026-01"), month("2026-02")], adjustments);
	expect(summary("history-x", rows)).toBe(40000);
	expect(summary("history-i", rows)).toBe(20000);
	expect(summary("history-t", rows)).toBe(0);
	expect(summary("history-tax", rows)).toBe(20000);
	expect(adjustmentFields.map((key) => summary(key, rows))).toEqual([
		30, 10, 40, 10,
	]);
	expect(summary("result-x", rows)).toBe(40020);
	expect(summary("result-i", rows)).toBe(20030);
	expect(summary("result-tax", rows)).toBe(19990);
	expect(summary("delta", rows)).toBe(-10);
});

test("汇总金额超过单笔录入上限仍可完整格式化", () => {
	const history = ["2026-01", "2026-02"].map((date) => ({
		...month(date),
		x: "9999999999.99",
		i: "0.00",
		tax: "9999999999.99",
	}));
	const rows = rowsFor(history);
	for (const id of ["history-x", "history-tax", "result-x", "result-tax"]) {
		const total = summary(id, rows);
		const column = vatGridColumns.find((candidate) => candidate.id === id);
		expect(total).toBe(1999999999998);
		expect(column?.formatAggregate?.(total, "zh-CN")).toBe("19,999,999,999.98");
	}
});

test("留抵余额按月份首末取值，不累加且不受行排序影响", () => {
	const history: HistoryRow[] = [
		{
			month: "2026-01",
			x: "100.00",
			i: "150.00",
			t: "0.00",
			tax: "0.00",
			end: "80.00",
		},
		{
			month: "2026-02",
			x: "120.00",
			i: "100.00",
			t: "0.00",
			tax: "0.00",
			end: "60.00",
		},
		{
			month: "2026-03",
			x: "150.00",
			i: "100.00",
			t: "0.00",
			tax: "0.00",
			end: "10.00",
		},
	];
	const rows = rowsFor(history, {
		"2026-01": adjustment({ outputIncrease: "20.00" }),
	});
	for (const ordered of [
		rows,
		rows.toReversed(),
		[rows[1], rows[2], rows[0]].filter((row): row is VatGridRow => !!row),
	]) {
		expect(summary("history-end", ordered)).toBe(1000);
		expect(summary("result-b", ordered)).toBe(3000);
		expect(summary("result-end", ordered)).toBe(0);
	}
	expect(summary("result-b", rows.slice(1))).toBe(6000);
});

test("汇总覆盖筛选后的全部月份，不依赖虚拟窗口或排序", () => {
	const history = Array.from({ length: 60 }, (_, index) =>
		month(
			`${2022 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
		),
	);
	const grid = createGrid({
		rows: rowsFor(history),
		columns: vatGridColumns,
		getRowId: vatGridRowId,
	});
	expect(grid.getSnapshot().viewRows).toHaveLength(60);
	expect(summary("history-x", grid.getSnapshot().viewRows)).toBe(1200000);
	grid.setState({ filters: { month: "2026" } });
	expect(grid.getSnapshot().viewRows).toHaveLength(12);
	expect(summary("history-x", grid.getSnapshot().viewRows)).toBe(240000);
	expect(summary("history-x", grid.getSnapshot().viewRows)).not.toBe(
		summary("history-x", grid.getSnapshot().viewRows.slice(0, 3)),
	);
	grid.sort("month", false, "desc");
	expect(summary("history-x", grid.getSnapshot().viewRows)).toBe(240000);
	grid.setState({ filters: {} });
	expect(summary("history-x", grid.getSnapshot().viewRows)).toBe(1200000);
});

test("空结果和缺历史不显示部分合计，余额只检查边界月", () => {
	for (const column of vatGridColumns.filter((column) => column.id !== "month"))
		expect(summary(column.id, [])).toBe("—");
	const rows = rowsFor([month("2026-01"), month("2026-03")]);
	for (const id of [
		"history-x",
		"history-i",
		"history-t",
		"history-tax",
		...adjustmentFields,
		"result-x",
		"result-i",
		"result-tax",
		"delta",
	])
		expect(summary(id, rows)).toBe("—");
	expect(summary("history-end", rows)).toBe(0);
	expect(summary("result-b", rows)).toBe(0);
	expect(summary("result-end", rows)).toBe("—");
});

test("四项中任一非法值不以零汇总，不影响其他合法调整列的独立汇总", () => {
	const history = [month("2026-01"), month("2026-02")];
	for (const invalidKey of adjustmentFields) {
		for (const invalid of ["oops", "0.001", "-0.01"]) {
			const adjustments = {
				"2026-01": adjustment({
					outputIncrease: "1.00",
					outputDecrease: "1.00",
					inputIncrease: "1.00",
					inputDecrease: "1.00",
					[invalidKey]: invalid,
				}),
			};
			const rows = rowsFor(history, adjustments);
			for (const key of adjustmentFields)
				expect(summary(key, rows)).toBe(key === invalidKey ? "—" : 100);
			expect(summary("history-tax", rows)).toBe(20000);
			expect(summary("result-tax", rows)).toBe("—");
			expect(summary("delta", rows)).toBe("—");
		}
	}
});

test("恢复的非法原值排序稳定且不参与数值筛选，清除筛选及修正后正常显示", async () => {
	const amounts = ["oops", "2.00", "-0.01", "0.001", "", "0.01"];
	const history = amounts.map((_, index) => month(`2026-0${index + 1}`));
	for (const key of adjustmentFields) {
		const adjustments = Object.fromEntries(
			history.map((row, index) => [
				row.month,
				adjustment({ [key]: amounts[index] ?? "" }),
			]),
		);
		const grid = createGrid({
			rows: rowsFor(history, adjustments),
			columns: vatGridColumns,
			getRowId: vatGridRowId,
		});
		const values = () =>
			grid
				.getSnapshot()
				.viewRows.map((row) => row[vatAdjustmentGridFields[key]]);
		grid.sort(key, false, "asc");
		expect(values()).toEqual(["", "0.01", "2.00", "oops", "-0.01", "0.001"]);
		grid.sort(key, false, "desc");
		expect(values()).toEqual(["oops", "-0.01", "0.001", "2.00", "0.01", ""]);
		grid.setState({ filters: { [key]: ">= 0" } });
		expect(values()).toEqual(["2.00", "0.01", ""]);
		grid.setState({ filters: { [key]: "= 0" } });
		expect(values()).toEqual([""]);
		grid.setState({ filters: { [key]: "" } });
		expect(values()).toHaveLength(6);
		expect(
			(await grid.edit({ rowId: "2026-01", columnId: key }, "1.00")).ok,
		).toBe(true);
		grid.setState({ filters: { [key]: ">= 0" } });
		expect(values()).toEqual(["2.00", "1.00", "0.01", ""]);
	}
});
