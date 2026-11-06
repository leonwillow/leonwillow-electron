/**
 * @file 滞纳金边界及金额精度回归。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：覆盖自然日、缴款日包含、分段与舍入的业务约定。
 * 被调用：test:calculators；调用：无副作用共享规则；预期结果：错误数据不显示完整合计。
 */
import { expect, test } from "bun:test";
import {
	calculateLateFees,
	calculateLiability,
	type TaxLiability,
} from "../src/late-fees";

const row: TaxLiability = {
	id: "tax",
	taxType: "vat",
	period: "2026-01",
	principal: "10000",
	deadline: "2026-02-15",
	note: "",
	payments: [],
};
const pay = (date: string, amount: string, id = date) => ({ id, date, amount });
test("期限当天不计费，次日开始，截止日与缴款当日计费", () => {
	expect(calculateLiability(row, "2026-02-15").fee).toBe(0);
	expect(calculateLiability(row, "2026-02-14").days).toBe(0);
	expect(calculateLiability(row, "2026-02-16")).toMatchObject({
		fee: 500,
		days: 1,
	});
	expect(
		calculateLiability(
			{ ...row, payments: [pay("2026-02-20", "10000")] },
			"2026-03-01",
		),
	).toMatchObject({ fee: 2500, days: 5, remaining: 0, total: 2500 });
});
test("部分缴款按次日减本金，同日多笔不会重复计费，提前缴款不计费", () => {
	const r = calculateLiability(
		{
			...row,
			payments: [
				pay("2026-02-20", "2000"),
				pay("2026-02-20", "2000", "second"),
			],
		},
		"2026-02-25",
	);
	expect(r).toMatchObject({
		fee: 4000,
		paid: 400000,
		remaining: 600000,
		days: 10,
	});
	expect(r.segments.map((s) => [s.start, s.end, s.days, s.balance])).toEqual([
		["2026-02-16", "2026-02-20", 5, 1000000],
		["2026-02-21", "2026-02-25", 5, 600000],
	]);
	expect(
		calculateLiability(
			{
				...row,
				payments: [pay("2026-02-01", "2000"), pay("2026-02-15", "3000")],
			},
			"2026-02-16",
		).fee,
	).toBe(250);
	expect(
		calculateLiability(
			{ ...row, payments: [pay("2026-02-15", "10000")] },
			"2026-02-16",
		).segments,
	).toEqual([]);
});
test("闰年、跨年与夏令时按自然日计数", () => {
	expect(
		calculateLiability({ ...row, deadline: "2024-02-28" }, "2024-03-01").days,
	).toBe(2);
	expect(
		calculateLiability({ ...row, deadline: "2025-12-31" }, "2026-01-01").days,
	).toBe(1);
	expect(
		calculateLiability({ ...row, deadline: "2026-03-07" }, "2026-03-10").days,
	).toBe(3);
});
test("按税款累计后一次舍入，不逐日或逐段舍入", () => {
	const r = calculateLiability(
		{ ...row, principal: "1", payments: [pay("2026-02-20", "0.01")] },
		"2026-02-26",
	);
	expect(r.segments.map((s) => s.feeExact)).toEqual(["0.002500", "0.002970"]);
	expect(r.fee).toBe(1);
	expect(calculateLiability({ ...row, principal: "1" }, "2026-02-25").fee).toBe(
		1,
	);
	expect(
		calculateLiability(
			{ ...row, principal: "9999999999.99", deadline: "2001-04-30" },
			"2199-12-31",
		).fee,
	).toBe(36281499999964);
});
test("无效日期、负数、超额、截止日后缴款及不支持的历史不产生结果", () => {
	for (const bad of [
		{ ...row, deadline: "2026-02-30" },
		{ ...row, deadline: "2001-04-29" },
		{ ...row, principal: "-1" },
		{ ...row, principal: "" },
		{ ...row, payments: [pay("2026-02-20", "10001")] },
		{ ...row, payments: [pay("2026-02-21", "1")] },
	]) {
		const r = calculateLateFees({
			cutoff: "2026-02-20",
			liabilities: [row, bad],
		});
		expect(r.totals).toBeNull();
		expect(r.rows[1]?.error).toBeTruthy();
	}
	expect(
		calculateLateFees({ cutoff: "", liabilities: [row] }).totals,
	).toBeNull();
});
test("多税种独立计算后汇总，原输入不被排序或更改", () => {
	const rows = [
		row,
		{ ...row, id: "cit", taxType: "cit-annual" as const, principal: "20000" },
	];
	const original = JSON.stringify(rows);
	const result = calculateLateFees({ cutoff: "2026-02-25", liabilities: rows });
	expect(result.totals).toEqual({
		principal: 3000000,
		paid: 0,
		remaining: 3000000,
		fee: 15000,
		total: 3015000,
	});
	expect(JSON.stringify(rows)).toBe(original);
});
