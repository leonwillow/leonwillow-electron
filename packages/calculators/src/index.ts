/**
 * @file 增值税 V5 普通计税规则与方案校验的无副作用共享实现。
 * 创建时间：2026-11-05；修改时间：2026-11-08。
 * 版本作用：浏览器即时预览和服务端权威重算使用同一整数分算法。
 * 被调用：计算器 UI、API 和领域测试；不依赖 DOM、数据库或框架。
 * 预期结果：原始申报可校正，未填所属期、断档或错误阻断后续计算；金额和累计值均有界。
 */
import {
	legacyPeriod,
	nextDate,
	type PeriodDates,
	periodDate,
	periodLabel,
	validatePeriods,
} from "./periods";

export {
	legacyPeriod,
	type PeriodDates,
	periodDate,
	periodLabel,
	type ReportingPeriod,
	reportingPeriod,
	reportingPeriodDates,
	reportingPeriodLabel,
	validatePeriods,
} from "./periods";
export const LEGACY_RULES_VERSION = "vat-fixed-history-v1";
export const PREVIOUS_RULES_VERSION = "vat-fixed-history-v2";
export const RULES_VERSION = "vat-periods-v3";
export const MAX_PERIODS = 1200;
export const fields = ["x", "i", "t", "tax", "end"] as const;
export type HistoryField = (typeof fields)[number];
export const labels = {
	x: "销项税额",
	i: "进项税额",
	t: "进项税额转出",
	tax: "应纳税额",
	end: "期末留抵",
};
export type LegacyHistoryRow = { month: string } & Record<HistoryField, string>;
export type HistoryRow = { id: string } & PeriodDates &
	Record<HistoryField, string>;
export type HistoryInput = HistoryRow | LegacyHistoryRow;
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
const object = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw Error("数据格式不正确");
	return value as Record<string, unknown>;
};
/** 旧月份映射到整月日期和稳定 ID；新空行必须带 ID，日期可暂缺。 */
export function normalizeHistoryRow(value: unknown): HistoryRow {
	const source = object(value);
	const legacy = typeof source.month === "string" && !("periodStart" in source);
	const dates = legacy
		? legacyPeriod(String(source.month))
		: {
				periodStart: periodDate(source.periodStart, true),
				periodEnd: periodDate(source.periodEnd, true),
			};
	const id = String(
		source.id ??
			(legacy
				? source.month
				: dates.periodStart && dates.periodEnd
					? `period-${dates.periodStart}-${dates.periodEnd}`
					: ""),
	);
	if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw Error("申报行标识无效");
	validatePeriods([dates]);
	const row = { id, ...dates } as HistoryRow;
	for (const key of fields) {
		try {
			const n = cents(source[key]);
			if ((key === "tax" || key === "end") && n < 0) throw Error("不能为负数");
			row[key] = raw(n);
		} catch (error) {
			throw Error(
				`${periodLabel(row)} ${labels[key]}：${error instanceof Error ? error.message : "无效金额"}`,
			);
		}
	}
	return row;
}

export function normalizeHistory(input: readonly HistoryInput[]): HistoryRow[] {
	if (input.length > MAX_PERIODS)
		throw Error(`最多支持 ${MAX_PERIODS} 条申报记录`);
	const rows = input.map(normalizeHistoryRow);
	if (new Set(rows.map((r) => r.id)).size !== rows.length)
		throw Error("存在重复申报行标识");
	validatePeriods(rows);
	return rows;
}

/** 保存按稳定 ID 更新并保留遗漏行；导入同一期间只合并一致金额，不覆盖已有资料。 */
export function mergeHistory(
	existing: readonly HistoryInput[],
	incoming: unknown[],
	allowUpdates = false,
	preserveIncomingOrder = false,
) {
	const original = normalizeHistory(existing);
	if (incoming.length > MAX_PERIODS)
		throw Error(`最多支持 ${MAX_PERIODS} 条申报记录`);
	const map = new Map(original.map((row) => [row.id, row]));
	const incomingIds = new Set<string>();
	const ordered: string[] = [];
	let added = 0;
	let updated = 0;
	let skipped = 0;
	for (const value of incoming) {
		let row = normalizeHistoryRow(value);
		const samePeriod =
			row.periodStart && row.periodEnd
				? [...map.values()].find(
						(old) =>
							old.periodStart === row.periodStart &&
							old.periodEnd === row.periodEnd,
					)
				: undefined;
		// 只有导入按期间去重；保存必须严格遵循行 ID，避免吞掉新插入的行。
		if (!allowUpdates && !map.has(row.id) && samePeriod)
			row = { ...row, id: samePeriod.id };
		if (incomingIds.has(row.id))
			throw Error(`${periodLabel(row)} 存在重复申报记录`);
		incomingIds.add(row.id);
		ordered.push(row.id);
		const old = map.get(row.id);
		if (old) {
			const differences = fields.filter((key) => old[key] !== row[key]);
			const dateChanged =
				old.periodStart !== row.periodStart || old.periodEnd !== row.periodEnd;
			if (differences.length || dateChanged) {
				if (!allowUpdates)
					throw Error(
						`${periodLabel(row)} 历史金额冲突：${differences.map((key) => `${labels[key]}（已有 ${old[key]}，本次 ${row[key]}）`).join("、")}。可在表格中手工修正原始申报。`,
					);
				map.set(row.id, row);
				updated++;
			} else skipped++;
		} else {
			map.set(row.id, row);
			added++;
		}
	}
	const rows =
		allowUpdates || preserveIncomingOrder
			? [
					...ordered.map((id) => map.get(id) as HistoryRow),
					...[...map.values()].filter((r) => !incomingIds.has(r.id)),
				]
			: [...map.values()].sort((a, b) =>
					a.periodStart.localeCompare(b.periodStart),
				);
	normalizeHistory(rows);
	return { rows, added, updated, skipped };
}

/** 插入持久化空行，不推断所属期、不改动原有金额与调整。 */
export function insertVatRows(
	data: VatData,
	anchorId: string | null,
	position: "above" | "below",
	ids: readonly string[],
): VatData {
	if (!ids.length || ids.length > 100) throw Error("每次可插入1至100行");
	if (
		new Set(ids).size !== ids.length ||
		ids.some((id) => data.history.some((r) => r.id === id))
	)
		throw Error("新增行标识重复");
	const index =
		anchorId === null
			? data.history.length
			: data.history.findIndex((r) => r.id === anchorId);
	if (index < 0) throw Error("目标行已变化，请重新选择");
	const rows = ids.map((id) =>
		normalizeHistoryRow({
			id,
			periodStart: "",
			periodEnd: "",
			x: "0.00",
			i: "0.00",
			t: "0.00",
			tax: "0.00",
			end: "0.00",
		}),
	);
	const history = [...data.history];
	history.splice(
		index + (anchorId && position === "below" ? 1 : 0),
		0,
		...rows,
	);
	normalizeHistory(history);
	return { ...data, history };
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
	history: readonly HistoryInput[],
	expected?: "legacy" | "current",
): Adjustments {
	const source = object(value);
	const known = new Set(history.map((row) => normalizeHistoryRow(row).id));
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
		(data.schema !== RULES_VERSION &&
			data.schema !== PREVIOUS_RULES_VERSION &&
			data.schema !== LEGACY_RULES_VERSION) ||
		!Array.isArray(data.history)
	)
		throw Error("请选择兼容的增值税方案 JSON 文件");
	const history =
		data.schema === RULES_VERSION
			? normalizeHistory(data.history)
			: mergeHistory([], data.history).rows;
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
export type CalculationRow = PeriodDates & {
	id: string;
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
/** 原按所属期时间顺序核对与联动；完整合计和导出只在所有所属期通过时可用。 */
export function calculate(
	input: readonly HistoryInput[],
	adjustments: AdjustmentInputs,
) {
	const history = normalizeHistory(input);
	const rows: CalculationRow[] = [];
	const ordered = history.toSorted((a, b) =>
		a.periodStart.localeCompare(b.periodStart),
	);
	const first = ordered.find((row) => row.periodStart && row.periodEnd);
	const incomplete = history.some((row) => !row.periodStart || !row.periodEnd);
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
	let newBlocked = incomplete;
	let previousPeriod: HistoryRow | undefined;
	for (const h of ordered) {
		const row: CalculationRow = {
			id: h.id,
			periodStart: h.periodStart,
			periodEnd: h.periodEnd,
			h,
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
		if (!h.periodStart || !h.periodEnd) {
			row.status = "gap";
			row.error = "请选择完整的所属期";
			baselineBlocked = true;
			newBlocked = true;
			continue;
		}
		if (
			previousPeriod &&
			nextDate(previousPeriod.periodEnd) !== h.periodStart
		) {
			row.status = "gap";
			row.error = `所属期不连续：请补齐 ${nextDate(previousPeriod.periodEnd)} 至 ${h.periodStart} 之前的申报`;
			baselineBlocked = true;
			newBlocked = true;
		}
		previousPeriod = h;
		const x = cents(h.x);
		const i = cents(h.i);
		const t = cents(h.t);
		const tax = cents(h.tax);
		const end = cents(h.end);
		let baselineError = "";
		if (!baselineBlocked) {
			if (previousOld < 0)
				baselineError = "首期反推期初留抵为负，当前普通计税口径不适用";
			else {
				const check = period(x, i, t, previousOld);
				if (check.tax !== tax || check.end !== end)
					baselineError = `普通计税核对不一致：计算应纳 ${money(check.tax)}、留抵 ${money(check.end)}；历史为 ${money(tax)}、${money(end)}。请核实适用口径。`;
			}
		}
		previousOld = end;
		const adjustment = normalizeAdjustment(adjustments[h.id] ?? {});
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
		} else if (row.status === "gap") {
			// 保留期间断档原因，后续链暂停。
		} else if (baselineBlocked || newBlocked) {
			row.status = "blocked";
			row.error = "等待所属期补齐或前序申报修正";
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
	const byId = new Map(rows.map((row) => [row.id, row]));
	return {
		rows: history.map((h) => byId.get(h.id) as CalculationRow),
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
		throw Error("请先补齐所属期并修正错误，再导出完整结果");
	const grid = [
		[
			"税款所属期起",
			"税款所属期止",
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
			row.periodStart,
			row.periodEnd,
			...fields.map((key) => row.h?.[key] ?? ""),
			...adjustmentFields.map((key) => raw(row[key])),
			...[row.n?.x, row.n?.i, row.n?.b, row.n?.tax, row.n?.end, row.delta].map(
				(n) => raw(n ?? 0),
			),
		]),
	];
	return `\ufeff${grid.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
}
