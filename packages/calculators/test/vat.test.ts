/**
 * @file V5 整数金额、逐月传递、导入和备份边界的领域回归。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：使用合成数据验证业务结果，不含源文件中的申报资料。
 * 被调用：bun test；调用：共享计算器规则和文本解析。
 * 预期结果：缺月/错误不会产生完整合计，导出始终使用全期计算。
 */
import { expect, test } from "bun:test";
import {
	adjustmentFields,
	adjustmentLabels,
	calculate,
	cents,
	changed,
	emptyAdjustment,
	type HistoryRow,
	LEGACY_RULES_VERSION,
	mergeHistory,
	normalizeAdjustments,
	RULES_VERSION,
	raw,
	readBackup,
	resultCsv,
} from "../src";
import { gridToHistory, parseDelimited, parsePeriod } from "../src/import";

const row = (
	month: string,
	x: string,
	i: string,
	tax: string,
	end: string,
	t = "0",
) => ({ month, x, i, t, tax, end });
const history = () =>
	mergeHistory(
		[],
		[
			row("2025-01", "100", "150", "0", "50"),
			row("2025-02", "100", "20", "30", "0"),
			row("2025-03", "100", "20", "80", "0"),
		],
	).rows;
test("金额精确到分，保留负值和千位分组，拒绝精度及溢出", () => {
	for (const [s, n] of [
		[".5", 50],
		["−1，234.56", -123456],
		["+0.01", 1],
		["-0.00", 0],
		["1.", 100],
	] as const)
		expect(cents(s)).toBe(n);
	expect(raw(cents("0.10") + cents("0.20"))).toBe("0.30");
	for (const s of [
		"1.001",
		"1,23",
		"NaN",
		"Infinity",
		"1e3",
		"10000000000.00",
		"",
	])
		expect(() => cents(s)).toThrow();
	expect(cents("", true)).toBe(0);
});
test("原申报不变，前月进项调增逐月抵扣，平衡校验通过", () => {
	const source = history();
	const before = JSON.stringify(source);
	const result = calculate(source, { "2025-01": { dx: "0", di: "100" } });
	expect(result.rows.map((r) => r.n?.tax)).toEqual([0, 0, 1000]);
	expect(result.rows.map((r) => r.n?.end)).toEqual([15000, 7000, 0]);
	expect(result.totals).toEqual({
		oldTax: 11000,
		newTax: 1000,
		delta: -10000,
		increase: 0,
		decrease: 10000,
		end: 0,
		carryDelta: 0,
	});
	expect(result.audit).toBe(true);
	expect(JSON.stringify(source)).toBe(before);
	expect(resultCsv(result).split("\r\n")).toHaveLength(4);
});
test("正负销项调整和剩余留抵均进入金额平衡", () => {
	const result = calculate(history(), {
		"2025-01": { dx: "-50", di: "100" },
		"2025-02": { dx: "10", di: "0" },
	});
	expect(result.totals.delta).toBe(-11000);
	expect(result.totals.carryDelta).toBe(3000);
	expect(result.audit).toBe(true);
});
test("缺月、历史口径和负期初分别阻断计算；补齐后恢复", () => {
	const source = history();
	const gap = calculate([source[0], source[2]] as HistoryRow[], {});
	expect(gap.rows.map((r) => r.status)).toEqual(["ready", "gap"]);
	expect(gap.totals.newTax).toBeNull();
	expect(() => resultCsv(gap)).toThrow();
	const mismatch = calculate(
		source.map((r, i) => (i === 1 ? { ...r, tax: "31.00" } : r)),
		{},
	);
	expect(mismatch.rows.map((r) => r.status)).toEqual([
		"ready",
		"error",
		"blocked",
	]);
	expect(
		calculate(mergeHistory([], [row("2025-01", "0", "100", "0", "0")]).rows, {})
			.rows[0]?.status,
	).toBe("error");
	expect(calculate(source, {}).totals.delta).toBe(0);
});
test("无效调整可备份，单独阻断调整链，历史验证仍执行", () => {
	const source = history().map((r, i) =>
		i === 2 ? { ...r, tax: "81.00" } : r,
	);
	const data = readBackup({
		schema: LEGACY_RULES_VERSION,
		history: source,
		adjustments: { "2025-01": { dx: "abc", di: "-1" } },
	});
	const result = calculate(data.history, data.adjustments);
	expect(result.rows[0]?.fieldErrors).toHaveProperty("inputIncrease");
	expect(result.rows[1]?.status).toBe("blocked");
	expect(result.rows[2]?.error).toContain("普通计税核对不一致");
	expect(result.totals.newTax).toBeNull();
});
test("历史冲突原子失败，重复跳过，空方案和跨度有界", () => {
	const source = history();
	const before = JSON.stringify(source);
	expect(mergeHistory(source, [source[0]])).toMatchObject({
		added: 0,
		skipped: 1,
	});
	expect(() => mergeHistory(source, [{ ...source[1], tax: "9" }])).toThrow(
		"冲突",
	);
	expect(JSON.stringify(source)).toBe(before);
	expect(() =>
		mergeHistory(
			[],
			Array.from({ length: 1201 }, (_, n) => ({
				id: `blank-${n}`,
				periodStart: "",
				periodEnd: "",
				x: "0",
				i: "0",
				t: "0",
				tax: "0",
				end: "0",
			})),
		),
	).toThrow("最多支持");
	expect(calculate([], {}).allReady).toBe(false);
	expect(() =>
		readBackup({
			schema: RULES_VERSION,
			history: source,
			adjustments: { "2024-01": { dx: "1" } },
		}),
	).toThrow("缺少");
});
test("CSV 引号、表头别名、小规模与合计排除", () => {
	const text =
		'\ufeff月份,销项税额（元）,进项税额,进项转出,应纳税额合计,期末留抵税额,申报类型\r\n2025-01,"1,000.00",500,0,500,0,一般纳税人\r\n2025-02,1,0,0,1,0,小规模纳税人\r\n合计,1001,500,0,501,0,\r\n';
	expect(gridToHistory(parseDelimited(text))).toMatchObject({
		excluded: 1,
		rows: [
			{ periodStart: "2025-01-01", periodEnd: "2025-01-31", x: "1000.00" },
		],
	});
	expect(parseDelimited('a,b\n"a""b","line\n2"')[1]).toEqual([
		'a"b',
		"line\n2",
	]);
	expect(() => parseDelimited('a,"b')).toThrow("引号");
});
test("所属期保留实际起止日期，支持季度、闰年和中文日期", () => {
	expect(parsePeriod("2024-02-01 至 2024-02-29")).toEqual({
		periodStart: "2024-02-01",
		periodEnd: "2024-02-29",
	});
	expect(parsePeriod("2025年1月1日", "2025年1月31日")).toEqual({
		periodStart: "2025-01-01",
		periodEnd: "2025-01-31",
	});
	expect(parsePeriod("2025/1")).toEqual({
		periodStart: "2025-01-01",
		periodEnd: "2025-01-31",
	});
	expect(parsePeriod("2025-01-01至2025-03-31")).toEqual({
		periodStart: "2025-01-01",
		periodEnd: "2025-03-31",
	});
	for (const s of [
		"2025-01-02",
		"2025-13",
		"2025-01junk",
		"2023-02-01至2023-02-29",
	])
		expect(() => parsePeriod(s)).toThrow();
});

test("四项金额分别保存计算，抵消仍标记调整并完整导出", () => {
	const adjustment = {
		outputIncrease: "60",
		outputDecrease: "10",
		inputIncrease: "20",
		inputDecrease: "5",
	};
	const before = JSON.stringify(adjustment);
	const result = calculate(history(), { "2025-01": adjustment });
	expect(result.rows[0]).toMatchObject({
		outputIncrease: 6000,
		outputDecrease: 1000,
		inputIncrease: 2000,
		inputDecrease: 500,
		dx: 5000,
		di: 1500,
		n: { x: 15000, i: 16500, end: 1500 },
	});
	expect(result.totals.delta).toBe(3500);
	expect(result.audit).toBe(true);
	expect(JSON.stringify(adjustment)).toBe(before);
	const csv = parseDelimited(resultCsv(result));
	expect(csv[0]?.slice(7, 11)).toEqual(
		adjustmentFields.map((key) => adjustmentLabels[key]),
	);
	expect(csv[1]?.slice(7, 11)).toEqual(["60.00", "10.00", "20.00", "5.00"]);
	const cancelled = calculate(history(), {
		"2025-01": {
			outputIncrease: "10",
			outputDecrease: "10",
			inputIncrease: "20",
			inputDecrease: "20",
		},
	});
	expect(cancelled.totals.delta).toBe(0);
	expect(cancelled.rows[0]).toMatchObject({ dx: 0, di: 0 });
	const [first, second] = cancelled.rows;
	if (!first || !second) throw Error("缺少测试月份");
	expect(changed(first)).toBe(true);
	expect(changed(second)).toBe(false);
});

test("四项均不接受负数，错误原文保留且阻断后续月份", () => {
	for (const key of adjustmentFields) {
		const adjustments = normalizeAdjustments(
			{ "2025-01": { ...emptyAdjustment(), [key]: "-1" } },
			history(),
		);
		expect(adjustments["2025-01"]?.[key]).toBe("-1");
		const result = calculate(history(), adjustments);
		expect(result.rows[0]?.fieldErrors[key]).toContain("不能为负数");
		expect(result.rows[1]?.status).toBe("blocked");
		expect(result.totals.newTax).toBeNull();
	}
});

test("v1 净额兼容转换，坏输入不消失，v2 备份保留四项独立金额", () => {
	const legacy = readBackup({
		schema: LEGACY_RULES_VERSION,
		history: history(),
		adjustments: {
			"2025-01": { dx: "−1，234.56", di: "-bad" },
			"2025-02": { dx: "bad", di: "-1" },
			"2025-03": { dx: "23.00", di: "4" },
		},
	});
	expect(legacy.adjustments["2025-01"]).toEqual({
		outputIncrease: "",
		outputDecrease: "1234.56",
		inputIncrease: "-bad",
		inputDecrease: "",
	});
	expect(legacy.adjustments["2025-02"]?.outputIncrease).toBe("bad");
	expect(legacy.adjustments["2025-02"]?.inputIncrease).toBe("-1");
	expect(legacy.adjustments["2025-03"]?.outputIncrease).toBe("23.00");
	const value = {
		schema: RULES_VERSION,
		history: history(),
		source: "测试",
		adjustments: {
			"2025-01": {
				outputIncrease: "12",
				outputDecrease: "12",
				inputIncrease: "7",
				inputDecrease: "7",
			},
		},
	};
	expect(readBackup(JSON.parse(JSON.stringify(value))).adjustments).toEqual(
		value.adjustments,
	);
	for (const [schema, adjustments] of [
		[RULES_VERSION, { "2025-01": { dx: "1", di: "2" } }],
		[LEGACY_RULES_VERSION, value.adjustments],
		[
			RULES_VERSION,
			{ "2025-01": { ...value.adjustments["2025-01"], dx: "0" } },
		],
	] as const)
		expect(() =>
			readBackup({ schema, history: history(), adjustments }),
		).toThrow("不可混用");
	expect(() =>
		normalizeAdjustments(
			{ "2025-01": { dx: "1", outputDecrease: "2" } },
			history(),
		),
	).toThrow("不可混用");
	expect(() => readBackup({ ...value, schema: "unknown" })).toThrow("兼容");
});

test("备份未知金额字段原子拒绝，空调整与已知坏原文仍可恢复", () => {
	for (const [schema, valid] of [
		[LEGACY_RULES_VERSION, { dx: "12", di: "7" }],
		[RULES_VERSION, { ...emptyAdjustment(), outputIncrease: "12" }],
	] as const) {
		for (const entry of [
			{ outputIncreaze: "999" },
			{ ...valid, typo: "999" },
		]) {
			const backup = {
				schema,
				history: history(),
				adjustments: { "2025-01": valid, "2025-02": entry },
			};
			const before = JSON.stringify(backup);
			expect(() => readBackup(backup)).toThrow("未知字段");
			expect(JSON.stringify(backup)).toBe(before);
		}
		expect(
			readBackup({ schema, history: history(), adjustments: { "2025-01": {} } })
				.adjustments["2025-01"],
		).toEqual(emptyAdjustment());
	}
	expect(
		normalizeAdjustments(
			{ "2025-01": { ...emptyAdjustment(), outputIncrease: "bad" } },
			history(),
		)["2025-01"]?.outputIncrease,
	).toBe("bad");
});

test("保存及手工录入允许原始申报校正，文件导入仍提示冲突，失败不修改旧对象", () => {
	const original = history();
	const before = JSON.stringify(original);
	const correction = { ...original[0], x: "120.00" };
	const merged = mergeHistory(original, [correction], true);
	expect(merged.updated).toBe(1);
	expect(merged.rows[0]?.x).toBe("120.00");
	expect(merged.rows.slice(1)).toEqual(original.slice(1));
	expect(JSON.stringify(original)).toBe(before);
	expect(() => mergeHistory(original, [correction])).toThrow(
		"可在表格中手工修正",
	);
	expect(() => mergeHistory(original, [correction, correction], true)).toThrow(
		"重复申报记录",
	);
	expect(() =>
		mergeHistory(original, [correction, { ...original[1], tax: "-1" }], true),
	).toThrow("不能为负数");
	expect(JSON.stringify(original)).toBe(before);
});
