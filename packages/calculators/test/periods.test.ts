/**
 * @file 所属期、空行插入与旧数据兼容的领域回归。
 * 创建时间：2026-11-06；修改时间：2026-11-08。
 * 调用：真实计税和导入函数；合成数据验证稳定身份、期间边界及保存重读。
 */
import { expect, test } from "bun:test";
import {
	calculate,
	emptyAdjustment,
	insertVatRows,
	mergeHistory,
	normalizeHistory,
	normalizeHistoryRow,
	RULES_VERSION,
	readBackup,
	reportingPeriod,
	reportingPeriodDates,
	reportingPeriodLabel,
	type VatData,
} from "../src";
import { gridToHistory, parsePeriod } from "../src/import";

const period = (id: string, start: string, end: string) =>
	normalizeHistoryRow({
		id,
		periodStart: start,
		periodEnd: end,
		x: "100",
		i: "50",
		t: "0",
		tax: "50",
		end: "0",
	});

test("月季选择准确展开闰年、季度及年份边界，旧范围不冒充整月或整季", () => {
	for (const [value, start, end] of [
		["2024-02", "2024-02-01", "2024-02-29"],
		["2026年2月", "2026-02-01", "2026-02-28"],
		["2026-Q1", "2026-01-01", "2026-03-31"],
		["2026年第二季度", "2026-04-01", "2026-06-30"],
		["2026年第3季度", "2026-07-01", "2026-09-30"],
		["2199-Q4", "2199-10-01", "2199-12-31"],
	] as const) {
		const dates = parsePeriod(value);
		expect(dates).toEqual({ periodStart: start, periodEnd: end });
		const selection = reportingPeriod(dates);
		expect(selection).not.toBeNull();
		if (selection) expect(reportingPeriodDates(selection)).toEqual(dates);
	}
	expect(reportingPeriodLabel(parsePeriod("2026-Q4"))).toBe("2026年第4季度");
	expect(reportingPeriodLabel(parsePeriod("2024-02"))).toBe("2024年2月");
	for (const dates of [
		{ periodStart: "", periodEnd: "" },
		{ periodStart: "2026-01-01", periodEnd: "" },
		{ periodStart: "2026-02-01", periodEnd: "2026-04-30" },
		{ periodStart: "2026-01-15", periodEnd: "2026-03-31" },
		{ periodStart: "2026-xx-01", periodEnd: "2026-03-31" },
	])
		expect(reportingPeriod(dates)).toBeNull();
	for (const value of ["2026-Q0", "2026-Q5", "2200-Q1", "2026-13", "2026-00"])
		expect(() => parsePeriod(value)).toThrow();
});

test("月报到季报再到月报按实际期间传递留抵，月季重叠拒绝重复计算", () => {
	const history = ["2026-01", "2026-02", "2026-03", "2026-Q2", "2026-07"].map(
		(value) => {
			const dates = parsePeriod(value);
			return period(value, dates.periodStart, dates.periodEnd);
		},
	);
	const result = calculate(history, {
		"2026-03": { ...emptyAdjustment(), inputIncrease: "75" },
	});
	expect(result.allReady).toBe(true);
	expect(result.rows.map((row) => row.n?.tax)).toEqual([
		5000, 5000, 0, 2500, 5000,
	]);
	expect(result.rows[3]?.n?.b).toBe(2500);
	expect(result.audit).toBe(true);
	expect(
		readBackup({
			schema: RULES_VERSION,
			source: "月季衔接",
			history,
			adjustments: {},
		}).history,
	).toEqual(history);
	const q1 = parsePeriod("2026-Q1");
	expect(() =>
		calculate([...history, period("q1", q1.periodStart, q1.periodEnd)], {}),
	).toThrow("重叠");
});

test("季度及非整月按原所属期计算，不生成中间月份", () => {
	const rows = [
		period("q1", "2024-01-01", "2024-03-31"),
		period("next", "2024-04-01", "2024-04-15"),
	];
	const result = calculate(rows.toReversed(), {
		q1: { ...emptyAdjustment(), inputIncrease: "60" },
	});
	expect(result.rows.map((r) => r.id)).toEqual(["next", "q1"]);
	expect(result.rows.map((r) => r.n?.tax)).toEqual([4000, 0]);
	expect(result.totals.newTax).toBe(4000);
	expect(result.audit).toBe(true);
});

test("插入只创建空行并保留指定位置，空日期可备份并重读", () => {
	const data: VatData = {
		source: "合成",
		history: [
			period("a", "2026-01-01", "2026-03-31"),
			period("b", "2026-04-01", "2026-06-30"),
		],
		adjustments: { a: emptyAdjustment() },
	};
	const before = JSON.stringify(data);
	const next = insertVatRows(data, "a", "below", ["blank1", "blank2"]);
	expect(next.history.map((r) => r.id)).toEqual(["a", "blank1", "blank2", "b"]);
	expect(next.history[1]).toMatchObject({
		periodStart: "",
		periodEnd: "",
		x: "0.00",
	});
	expect(calculate(next.history, next.adjustments).totals.newTax).toBeNull();
	expect(readBackup({ schema: RULES_VERSION, ...next })).toEqual(next);
	expect(mergeHistory([], next.history, false, true).rows).toEqual(
		next.history,
	);
	expect(mergeHistory(data.history, next.history, true).rows).toEqual(
		next.history,
	);
	expect(JSON.stringify(data)).toBe(before);
	expect(insertVatRows(data, "a", "above", ["first"]).history[0]?.id).toBe(
		"first",
	);
	expect(() => insertVatRows(data, "missing", "above", ["new"])).toThrow(
		"目标行",
	);
	expect(() => insertVatRows(data, "a", "below", ["a"])).toThrow("重复");
	expect(() => insertVatRows(data, "a", "below", [])).toThrow("1至100");
});

test("起止日期独立保存，改日期不改变行 ID 或调整键", () => {
	const initial = period("row", "", "");
	const start = mergeHistory(
		[initial],
		[{ ...initial, periodStart: "2024-02-15" }],
		true,
	).rows;
	expect(start[0]?.periodEnd).toBe("");
	const complete = mergeHistory(
		start,
		[{ ...start[0], periodEnd: "2024-02-29" }],
		true,
	).rows;
	expect(complete[0]?.id).toBe("row");
	expect(
		calculate(complete, { row: { ...emptyAdjustment(), outputIncrease: "5" } })
			.totals.delta,
	).toBe(500);
});

test("非法日期、倒置、重叠和重复行原子拒绝，允许相邻期间", () => {
	expect(() => period("a", "2023-02-29", "2023-03-01")).toThrow("无效");
	expect(() => period("a", "2026-03-01", "2026-02-28")).toThrow("不能晚于");
	const rows = [
		period("a", "2026-01-01", "2026-03-31"),
		period("b", "2026-04-01", "2026-06-30"),
	];
	expect(() => normalizeHistory(rows)).not.toThrow();
	// 保存新 ID 的重复期间不能被误当作导入去重，已有记录始终保持原身份。
	expect(() =>
		mergeHistory(
			[rows[0]] as typeof rows,
			[{ ...rows[0], id: "new-id" }],
			true,
		),
	).toThrow("重叠");
	expect(() =>
		normalizeHistory([
			rows[0],
			{ ...rows[1], periodStart: "2026-03-31" },
		] as typeof rows),
	).toThrow("重叠");
	expect(() => normalizeHistory([rows[0], rows[0]] as typeof rows)).toThrow(
		"重复",
	);
	const gap = calculate(
		[rows[0], period("b", "2026-04-02", "2026-06-30")] as typeof rows,
		{},
	);
	expect(gap.rows[1]?.error).toContain("所属期不连续");
	expect(gap.totals.newTax).toBeNull();
});

test("税务表两列日期原样读取，旧月份转整月并保留调整键", () => {
	const parsed = gridToHistory([
		[
			"税款所属期起",
			"税款所属期止",
			"销项税额",
			"进项税额",
			"进项税额转出",
			"应纳税额",
			"期末留抵",
		],
		["2024-01-15", "2024-03-31", "100", "50", "0", "50", "0"],
	]);
	expect(parsed.rows[0]).toMatchObject({
		periodStart: "2024-01-15",
		periodEnd: "2024-03-31",
	});
	const old = {
		month: "2024-02",
		x: "100",
		i: "50",
		t: "0",
		tax: "50",
		end: "0",
	};
	const loaded = readBackup({
		schema: "vat-fixed-history-v2",
		history: [old],
		adjustments: { "2024-02": { ...emptyAdjustment(), inputIncrease: "10" } },
	});
	expect(loaded.history[0]).toMatchObject({
		id: "2024-02",
		periodStart: "2024-02-01",
		periodEnd: "2024-02-29",
	});
	expect(calculate(loaded.history, loaded.adjustments).totals.delta).toBe(
		-1000,
	);
});
