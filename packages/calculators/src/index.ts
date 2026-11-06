/**
 * @file 增值税 V5 普通计税规则与方案校验的无副作用共享实现。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：浏览器即时预览和服务端权威重算使用同一整数分算法。
 * 被调用：计算器 UI、API 和领域测试；不依赖 DOM、数据库或框架。
 * 预期结果：历史不可覆盖，缺月/错误阻断后续计算；金额和累计值均有界。
 */
export const LEGACY_RULES_VERSION = "vat-fixed-history-v1";
export const RULES_VERSION = "vat-fixed-history-v2";
export const MAX_MONTHS = 1200;
export const fields = ["x", "i", "t", "tax", "end"] as const;
export const labels = {
	x: "销项税额",
	i: "进项税额",
	t: "进项税额转出",
	tax: "应纳税额",
	end: "期末留抵",
};
export type HistoryRow = { month: string } & Record<
	(typeof fields)[number],
	string
>;
export const adjustmentFields = [
	"outputIncrease",
	"outputDecrease",
	"inputIncrease",
	"inputDecrease",
] as const;
export type AdjustmentField = (typeof adjustmentFields)[number];
export const adjustmentLabels: Record<AdjustmentField, string> = {
	outputIncrease: "调增销项",
	outputDecrease: "调减销项",
	inputIncrease: "调增进项",
	inputDecrease: "调减进项",
};
export type Adjustment = Record<AdjustmentField, string>;
export type LegacyAdjustment = { dx: string; di: string };
export type Adjustments = Record<string, Adjustment>;
export type AdjustmentInputs = Record<string, Adjustment | LegacyAdjustment>;
export const emptyAdjustment = (): Adjustment => ({
	outputIncrease: "",
	outputDecrease: "",
	inputIncrease: "",
	inputDecrease: "",
});
export type VatData = {
	source: string;
	history: HistoryRow[];
	adjustments: Adjustments;
};
export function exact(n: number) {
	if (!Number.isSafeInteger(n)) throw Error("累计金额超出可计算范围");
	return n;
}
export function cents(value: unknown, emptyZero = false): number {
	if (typeof value !== "string" && typeof value !== "number")
		throw Error("请输入金额");
	let s = String(value).trim().replace(/−/g, "-").replace(/，/g, ",");
	if (!s && emptyZero) return 0;
	s = s.replace(/^([+-]?)\./, "$10.");
	if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(s))
		throw Error("金额须为数字，最多两位小数");
	const negative = s.startsWith("-");
	const [whole, fraction = ""] = s.replace(/[+,-]/g, "").split(".");
	const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
	if (!Number.isSafeInteger(n) || n > 999_999_999_999)
		throw Error("金额超出可录入范围");
	return negative && n !== 0 ? -n : n;
}
export function raw(n: number): string {
	exact(n);
	return `${n < 0 ? "-" : ""}${Math.floor(Math.abs(n) / 100)}.${String(Math.abs(n) % 100).padStart(2, "0")}`;
}
export function money(n: number | null): string {
	return n === null ? "—" : raw(n).replace(/\B(?=(\d{3})+\.)/g, ",");
}
export function monthIndex(month: string) {
	if (!/^(19\d{2}|20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(month))
		throw Error("所属期须为1900—2199年的有效月份");
	return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
}
export const fromIndex = (n: number) =>
	`${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
const object = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw Error("数据格式不正确");
	return value as Record<string, unknown>;
};
export function normalizeHistoryRow(value: unknown): HistoryRow {
	const source = object(value);
	const month = String(source.month ?? "").trim();
	monthIndex(month);
	const row = { month } as HistoryRow;
	for (const key of fields) {
		try {
			const n = cents(source[key]);
			if ((key === "tax" || key === "end") && n < 0) throw Error("不能为负数");
			row[key] = raw(n);
		} catch (error) {
			throw Error(
				`${month} ${labels[key]}：${error instanceof Error ? error.message : "无效金额"}`,
			);
		}
	}
	return row;
}
/** 合并是全量原子校验；同月冲突抛错，遗漏旧月份不会删除已锁定历史。 */
export function mergeHistory(existing: HistoryRow[], incoming: unknown[]) {
	if (incoming.length > MAX_MONTHS)
		throw Error(`最多支持 ${MAX_MONTHS} 条历史记录`);
	const map = new Map(existing.map((row) => [row.month, row]));
	let added = 0;
	let skipped = 0;
	for (const source of incoming) {
		const row = normalizeHistoryRow(source);
		const old = map.get(row.month);
		if (old) {
			const differences = fields.filter((key) => old[key] !== row[key]);
			if (differences.length)
				throw Error(
					`${row.month} 历史金额冲突：${differences.map((key) => `${labels[key]}（已锁定 ${old[key]}，本次 ${row[key]}）`).join("、")}。未覆盖历史数据。`,
				);
			skipped++;
			continue;
		}
		map.set(row.month, row);
		added++;
	}
	const rows = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
	if (
		rows.length &&
		monthIndex(rows.at(-1)?.month ?? "") -
			monthIndex(rows[0]?.month ?? "") +
			1 >
			MAX_MONTHS
	)
		throw Error(`历史跨度最多支持 ${MAX_MONTHS} 个月`);
	return { rows, added, skipped };
}
/** 新旧格式不可混用；旧净销项拆为增减项，无法解析的原文保留以便修正。 */
function normalizeAdjustment(
	value: unknown,
	expected?: "legacy" | "current",
): Adjustment {
	const source = object(value);
	const legacy = ["dx", "di"].some((key) => Object.hasOwn(source, key));
	const current = adjustmentFields.some((key) => Object.hasOwn(source, key));
	if (
		(legacy && current) ||
		(expected === "legacy" && current) ||
		(expected === "current" && legacy)
	)
		throw Error("调整金额的新旧格式不可混用，请核对方案版本");
	const allowed: readonly string[] = legacy ? ["dx", "di"] : adjustmentFields;
	if (Object.keys(source).some((key) => !allowed.includes(key)))
		throw Error("调整金额包含未知字段，请核对方案格式");
	const read = (key: string) => {
		const value = source[key];
		if (
			value !== undefined &&
			typeof value !== "string" &&
			typeof value !== "number"
		)
			throw Error("调整金额格式不正确");
		const text = String(value ?? "");
		if (text.length > 100) throw Error("调整内容最多100个字符");
		return text;
	};
	if (!legacy)
		return Object.fromEntries(
			adjustmentFields.map((key) => [key, read(key)]),
		) as Adjustment;
	const result = emptyAdjustment();
	const dx = read("dx");
	result.outputIncrease = dx;
	result.inputIncrease = read("di");
	try {
		const amount = cents(dx, true);
		if (amount < 0) {
			result.outputIncrease = "";
			result.outputDecrease = raw(-amount);
		}
	} catch {
		// 原有非法输入保持可见，计算阶段返回对应字段错误。
	}
	return result;
}
export function normalizeAdjustments(
	value: unknown,
	history: HistoryRow[],
	expected?: "legacy" | "current",
): Adjustments {
	const source = object(value);
	const known = new Set(history.map((row) => row.month));
	const out: Adjustments = {};
	for (const [month, value] of Object.entries(source)) {
		if (!known.has(month)) throw Error(`${month} 的调整缺少对应历史数据`);
		out[month] = normalizeAdjustment(value, expected);
	}
	return out;
}
/** v1 备份转为四项；v2 明确标记新结构，防止旧版本静默丢失调减项。 */
export function readBackup(value: unknown): VatData {
	const data = object(value);
	if (
		(data.schema !== RULES_VERSION && data.schema !== LEGACY_RULES_VERSION) ||
		!Array.isArray(data.history)
	)
		throw Error("请选择兼容的增值税方案 JSON 文件");
	const history = mergeHistory([], data.history).rows;
	return {
		history,
		adjustments: normalizeAdjustments(
			data.adjustments ?? {},
			history,
			data.schema === LEGACY_RULES_VERSION ? "legacy" : "current",
		),
		source: String(data.source ?? "导入方案").slice(0, 200),
	};
}
function period(x: number, i: number, t: number, b: number) {
	const available = exact(exact(i + b) - t);
	const difference = exact(x - available);
	return {
		x,
		i,
		t,
		b,
		tax: Math.max(difference, 0),
		end: Math.max(-difference, 0),
	};
}
export type CalculationRow = {
	month: string;
	h: HistoryRow | null;
	status: "ready" | "gap" | "error" | "blocked";
	error?: string;
	fieldErrors: Partial<Record<AdjustmentField, string>>;
	outputIncrease: number;
	outputDecrease: number;
	inputIncrease: number;
	inputDecrease: number;
	dx: number;
	di: number;
	n: ReturnType<typeof period> | null;
	delta: number | null;
	carryDelta: number | null;
};
/** 原历史核对与调整链分别阻断；完整合计和导出只在所有自然月通过时可用。 */
export function calculate(
	history: HistoryRow[],
	adjustments: AdjustmentInputs,
) {
	const rows: CalculationRow[] = [];
	const first = history[0];
	const last = history.at(-1);
	const opening = first
		? exact(
				cents(first.x) -
					cents(first.i) +
					cents(first.t) -
					cents(first.tax) +
					cents(first.end),
			)
		: 0;
	let previousOld = opening;
	let previousNew = opening;
	let baselineBlocked = false;
	let newBlocked = false;
	const byMonth = new Map(history.map((row) => [row.month, row]));
	if (first && last)
		for (let m = monthIndex(first.month); m <= monthIndex(last.month); m++) {
			const month = fromIndex(m);
			const h = byMonth.get(month);
			const row: CalculationRow = {
				month,
				h: h ?? null,
				status: "ready",
				fieldErrors: {},
				outputIncrease: 0,
				outputDecrease: 0,
				inputIncrease: 0,
				inputDecrease: 0,
				dx: 0,
				di: 0,
				n: null,
				delta: null,
				carryDelta: null,
			};
			rows.push(row);
			if (!h) {
				row.status = "gap";
				row.error = "缺少历史申报，请补入该月";
				baselineBlocked = true;
				newBlocked = true;
				continue;
			}
			const x = cents(h.x);
			const i = cents(h.i);
			const t = cents(h.t);
			const tax = cents(h.tax);
			const end = cents(h.end);
			let baselineError = "";
			if (!baselineBlocked) {
				if (previousOld < 0)
					baselineError = "首月反推期初留抵为负，当前普通计税口径不适用";
				else {
					const check = period(x, i, t, previousOld);
					if (check.tax !== tax || check.end !== end)
						baselineError = `普通计税核对不一致：计算应纳 ${money(check.tax)}、留抵 ${money(check.end)}；历史为 ${money(tax)}、${money(end)}。请核实适用口径。`;
				}
			}
			previousOld = end;
			const adjustment = normalizeAdjustment(adjustments[month] ?? {});
			for (const key of adjustmentFields) {
				try {
					const amount = cents(adjustment[key], true);
					if (amount < 0) throw Error(`${adjustmentLabels[key]}不能为负数`);
					row[key] = amount;
				} catch (error) {
					row.fieldErrors[key] =
						error instanceof Error ? error.message : "无效金额";
				}
			}
			row.dx = exact(row.outputIncrease - row.outputDecrease);
			row.di = exact(row.inputIncrease - row.inputDecrease);
			if (baselineError) {
				row.status = "error";
				row.error = baselineError;
				baselineBlocked = true;
				newBlocked = true;
			} else if (Object.keys(row.fieldErrors).length) {
				row.status = "error";
				row.error = Object.entries(row.fieldErrors)
					.map(
						([key, message]) =>
							`${adjustmentLabels[key as AdjustmentField]}：${message}`,
					)
					.join("；");
				newBlocked = true;
			} else if (baselineBlocked || newBlocked) {
				row.status = "blocked";
				row.error = "等待前序月份补齐或修正";
			} else {
				try {
					row.n = period(exact(x + row.dx), exact(i + row.di), t, previousNew);
					row.delta = exact(row.n.tax - tax);
					row.carryDelta = exact(row.n.end - end);
					previousNew = row.n.end;
				} catch (error) {
					row.n = null;
					row.status = "error";
					row.error = error instanceof Error ? error.message : "计算失败";
					newBlocked = true;
				}
			}
		}
	const sum = (values: number[]) => values.reduce((a, b) => exact(a + b), 0);
	const allReady = rows.length > 0 && rows.every((row) => row.n);
	const oldTax = sum(history.map((row) => cents(row.tax)));
	const newTax = allReady ? sum(rows.map((row) => row.n?.tax ?? 0)) : null;
	const delta = newTax === null ? null : exact(newTax - oldTax);
	const carryDelta = allReady ? (rows.at(-1)?.carryDelta ?? 0) : null;
	return {
		rows,
		opening,
		allReady,
		computed: rows.filter((row) => row.n).length,
		audit:
			delta !== null && carryDelta !== null
				? exact(delta - carryDelta) ===
					sum(rows.map((row) => exact(row.dx - row.di)))
				: null,
		totals: {
			oldTax,
			newTax,
			delta,
			carryDelta,
			end: allReady ? previousNew : null,
			increase: allReady
				? sum(rows.map((row) => Math.max(row.delta ?? 0, 0)))
				: null,
			decrease: allReady
				? sum(rows.map((row) => Math.max(-(row.delta ?? 0), 0)))
				: null,
		},
	};
}
export type Calculation = ReturnType<typeof calculate>;
export const changed = (row: CalculationRow) =>
	row.status !== "ready" ||
	adjustmentFields.some((key) => row[key] !== 0) ||
	!!row.delta ||
	!!row.carryDelta;
export function resultCsv(result: Calculation) {
	if (!result.allReady || !result.audit)
		throw Error("请先补齐月份并修正错误，再导出完整结果");
	const grid = [
		[
			"税款所属期",
			...fields.map((key) => `原${labels[key]}`),
			...adjustmentFields.map((key) => adjustmentLabels[key]),
			"调整后销项",
			"调整后进项",
			"调整后期初留抵",
			"调整后应纳",
			"调整后留抵",
			"应纳增减",
		],
		...result.rows.map((row) => [
			row.month,
			...fields.map((key) => row.h?.[key] ?? ""),
			...adjustmentFields.map((key) => raw(row[key])),
			...[row.n?.x, row.n?.i, row.n?.b, row.n?.tax, row.n?.end, row.delta].map(
				(n) => raw(n ?? 0),
			),
		]),
	];
	return `\ufeff${grid.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
}
