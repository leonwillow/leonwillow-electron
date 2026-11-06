/**
 * @file 增值税领域数据与通用 Lattice Grid 的列及批量更新适配。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：隔离税务字段、整数金额规则与通用表格内核。
 * 被调用：VatTable、适配回归；调用：calculators 金额函数、Grid 类型。
 * 预期结果：只允许调整列写入，一次粘贴/撤销只产生一次调整快照，历史与联动结果始终只读。
 */
import {
	type AdjustmentField,
	type Adjustments,
	adjustmentFields,
	adjustmentLabels,
	type CalculationRow,
	cents,
	emptyAdjustment,
	exact,
	fields,
	labels,
	money,
	raw,
} from "@leonwillow-electron/calculators";
import {
	type CellValue,
	type Column,
	numericFilter,
} from "@leonwillow-electron/lattice-grid/core";

export const vatAdjustmentGridFields = {
	outputIncrease: "adjustmentOutputIncrease",
	outputDecrease: "adjustmentOutputDecrease",
	inputIncrease: "adjustmentInputIncrease",
	inputDecrease: "adjustmentInputDecrease",
} as const;
export type VatGridRow = CalculationRow &
	Record<(typeof vatAdjustmentGridFields)[AdjustmentField], string>;
export type VatGridChange = {
	month: string;
	key: AdjustmentField;
	value: string;
};
export const vatGridRowId = (row: VatGridRow) => row.month;

/** 四项分别录入非负金额，按整数分解析；空输入保留为空供撤销与未录入状态使用。 */
export function parseVatAdjustment(value: string, key: AdjustmentField) {
	if (!value.trim()) return "";
	const amount = cents(value, true);
	if (amount < 0) throw Error(`${adjustmentLabels[key]}不能为负数`);
	return raw(amount);
}

export function vatGridRows(
	rows: CalculationRow[],
	adjustments: Adjustments,
): VatGridRow[] {
	return rows.map((row) => ({
		...row,
		adjustmentOutputIncrease: adjustments[row.month]?.outputIncrease ?? "",
		adjustmentOutputDecrease: adjustments[row.month]?.outputDecrease ?? "",
		adjustmentInputIncrease: adjustments[row.month]?.inputIncrease ?? "",
		adjustmentInputDecrease: adjustments[row.month]?.inputDecrease ?? "",
	}));
}

/** 比较事务前后调整字段；撤销/重做即使没有 patches 也能准确回写，忽略只读派生字段。 */
export function vatGridChanges(
	previous: readonly VatGridRow[],
	next: readonly VatGridRow[],
): VatGridChange[] {
	const before = new Map(previous.map((row) => [row.month, row]));
	const changes: VatGridChange[] = [];
	for (const row of next) {
		const old = before.get(row.month);
		if (!old?.h || !row.h) continue;
		for (const key of adjustmentFields) {
			const field = vatAdjustmentGridFields[key];
			if (old[field] !== row[field])
				changes.push({ month: row.month, key, value: row[field] });
		}
	}
	return changes;
}

/** 一次性应用完整事务，不修改旧对象，保留其他月份和同月其他三项调整。 */
export function applyVatGridChanges(
	adjustments: Adjustments,
	changes: readonly VatGridChange[],
): Adjustments {
	const next = { ...adjustments };
	for (const change of changes) {
		next[change.month] = {
			...emptyAdjustment(),
			...next[change.month],
			[change.key]: change.value,
		};
	}
	return next;
}

/** 汇总当前筛选范围的整数分；缺项、非法输入或溢出时不输出部分合计。 */
function sumAmounts(
	rows: readonly VatGridRow[],
	amount: (row: VatGridRow) => number | null,
) {
	if (!rows.length) return "—";
	try {
		let total = 0;
		for (const row of rows) {
			const value = amount(row);
			if (value === null) return "—";
			total = exact(total + value);
		}
		return total;
	} catch {
		return "—";
	}
}

/** 余额取所选月份的时间边界；改变表格排序不会改变首月/末月。 */
function boundaryAmount(
	rows: readonly VatGridRow[],
	amount: (row: VatGridRow) => number | null,
	edge: "first" | "last",
) {
	const row = rows.reduce<VatGridRow | undefined>(
		(selected, candidate) =>
			!selected ||
			(edge === "first"
				? candidate.month < selected.month
				: candidate.month > selected.month)
				? candidate
				: selected,
		undefined,
	);
	if (!row) return "—";
	try {
		return amount(row) ?? "—";
	} catch {
		return "—";
	}
}

const formatAmountTotal: NonNullable<Column<VatGridRow>["formatAggregate"]> = (
	value,
) => (typeof value === "number" ? money(value) : String(value ?? "—"));

/** 恢复的无效原值可继续展示；排序/筛选不让单个无效输入中断整张表。 */
function comparableAdjustment(value: CellValue) {
	try {
		const amount = cents(value ?? "", true);
		return amount >= 0 ? amount : null;
	} catch {
		return null;
	}
}

const resultLabels = {
	x: "销项税额",
	i: "进项税额",
	b: "期初留抵",
	tax: "应纳税额",
	end: "期末留抵",
} as const;
export const vatGridColumns: Column<VatGridRow>[] = [
	{
		id: "month",
		field: "month",
		header: "所属月份",
		aggregateLabel: "当前汇总",
		aggregate: (rows) => `${rows.length} 个月`,
		width: 210,
		minWidth: 170,
		pinned: true,
		editable: false,
	},
	...fields.map(
		(key): Column<VatGridRow> => ({
			id: `history-${key}`,
			header: labels[key],
			group: "原始申报 · 只读",
			aggregateLabel: key === "end" ? "末月期末" : "",
			aggregate: (rows) =>
				key === "end"
					? boundaryAmount(
							rows,
							(row) => (row.h ? cents(row.h[key]) : null),
							"last",
						)
					: sumAmounts(rows, (row) => (row.h ? cents(row.h[key]) : null)),
			formatAggregate: formatAmountTotal,
			type: "number",
			width: 150,
			editable: false,
			// 表格复制/筛选采用元字符串，领域计算仍保留整数分，避免显示 100 元却复制为 10000。
			getValue: (row) => (row.h ? raw(cents(row.h[key])) : null),
			format: (_value, row) => money(row.h ? cents(row.h[key]) : null),
		}),
	),
	...adjustmentFields.map(
		(key): Column<VatGridRow> => ({
			id: key,
			field: vatAdjustmentGridFields[key],
			header: adjustmentLabels[key],
			group: key.startsWith("output") ? "销项调整" : "进项调整",
			aggregateLabel: "",
			aggregate: (rows) =>
				sumAmounts(rows, (row) =>
					row.h
						? cents(
								parseVatAdjustment(row[vatAdjustmentGridFields[key]], key),
								true,
							)
						: null,
				),
			formatAggregate: formatAmountTotal,
			align: "end",
			inputMode: "decimal",
			width: 155,
			editable: (row) => !!row.h,
			parse: (input) => parseVatAdjustment(input, key),
			compare: (a, b) => {
				const first = comparableAdjustment(a);
				const second = comparableAdjustment(b);
				if (first === null) return second === null ? 0 : 1;
				if (second === null) return -1;
				return first - second;
			},
			filter: (value, filter) => {
				if (typeof filter !== "string")
					return filter.includes(String(value ?? ""));
				if (!filter.trim()) return true;
				const amount = comparableAdjustment(value);
				return (
					amount !== null && (numericFilter(filter)?.(amount / 100) ?? false)
				);
			},
			validate: (value) => {
				try {
					parseVatAdjustment(String(value ?? ""), key);
					return undefined;
				} catch (error) {
					return error instanceof Error ? error.message : "金额无效";
				}
			},
			format: (value) => String(value || "0.00"),
			formatEdit: (value) => String(value || "0.00"),
		}),
	),
	...(Object.keys(resultLabels) as (keyof typeof resultLabels)[]).map(
		(key): Column<VatGridRow> => ({
			id: `result-${key}`,
			header: resultLabels[key],
			aggregateLabel:
				key === "b" ? "首月期初" : key === "end" ? "末月期末" : "",
			aggregate: (rows) =>
				key === "b" || key === "end"
					? boundaryAmount(
							rows,
							(row) => row.n?.[key] ?? null,
							key === "b" ? "first" : "last",
						)
					: sumAmounts(rows, (row) => row.n?.[key] ?? null),
			formatAggregate: formatAmountTotal,
			group: "调整后 · 按月联动",
			type: "number",
			width: 150,
			editable: false,
			getValue: (row) => (row.n ? raw(row.n[key]) : null),
			format: (_value, row) => money(row.n?.[key] ?? null),
		}),
	),
	{
		id: "delta",
		getValue: (row) => (row.delta == null ? null : raw(row.delta)),
		header: "应纳增减",
		aggregateLabel: "",
		aggregate: (rows) => sumAmounts(rows, (row) => row.delta),
		formatAggregate: (value) =>
			`${typeof value === "number" && value > 0 ? "+" : ""}${formatAmountTotal(value, "zh-CN")}`,
		group: "调整后 · 按月联动",
		type: "number",
		width: 150,
		editable: false,
		format: (_value, row) =>
			`${row.delta != null && row.delta > 0 ? "+" : ""}${money(row.delta)}`,
	},
];
