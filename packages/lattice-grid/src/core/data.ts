/**
 * @file Lattice Grid data：泛型表格数据与事务内核。
 * 创建时间：2026-11-05；修改时间：2026-11-21。
 * 版本作用：适配 MIT Lattice Grid 0.1.0-beta.1，保留原始行标识、不可变事务与数据隔离。
 * 被调用：独立表格包的 React 视图；调用：包内核心模块，不依赖业务、数据库或路由。
 * 预期结果：多个表格实例独立工作，纯负数金额导出不误加单引号，数值筛选不将空值当作零。
 */
import type { CellRange, CellValue, Column, GridState } from "./types";
export function getCellValue<T>(row: T, column: Column<T>): CellValue {
	return column.getValue
		? column.getValue(row)
		: (row[column.field ?? (column.id as keyof T)] as CellValue);
}
export function formatValue<T>(
	row: T,
	column: Column<T>,
	locale = "en-US",
): string {
	const v = getCellValue(row, column);
	return column.format
		? column.format(v, row, locale)
		: v == null
			? ""
			: String(v);
}
export function numericFilter(query: string): ((n: number) => boolean) | null {
	const q = query.trim().replace(/[¥￥$,%\s]/g, "");
	if (!q) return () => true;
	const range = q.match(/^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/);
	if (range) return (n) => n >= Number(range[1]) && n <= Number(range[2]);
	const m = q.match(/^(>=|<=|!=|>|<|=)?(-?\d+(?:\.\d+)?)$/);
	if (!m) return null;
	const n = Number(m[2]);
	switch (m[1]) {
		case ">":
			return (v) => v > n;
		case "<":
			return (v) => v < n;
		case ">=":
			return (v) => v >= n;
		case "<=":
			return (v) => v <= n;
		case "!=":
			return (v) => v !== n;
		default:
			return (v) => v === n;
	}
}
// 仅数字、空白及金额/日期标点没有大小写；含任何其他字符仍遵守 locale。
const uncasedNumericText = /^[\d\s.,+-]*$/;
function normalizeSearchText(text: string, locale: string) {
	return uncasedNumericText.test(text) ? text : text.toLocaleLowerCase(locale);
}

/**
 * 每个 store 独占当前不可变数据版本的搜索文本；不保留历史版本或跨实例缓存。
 * 惰性读取每格的显示文本和原值，继续按单格匹配，禁止跨格拼接造成误命中。
 */
export class SearchTextCache<T> {
	private rows?: readonly T[];
	private columns?: readonly Column<T>[];
	private locale = "";
	private values = new Map<T, { formatted: string[]; raw: string[] }>();
	prepare(rows: readonly T[], columns: readonly Column<T>[], locale: string) {
		if (
			rows !== this.rows ||
			columns !== this.columns ||
			locale !== this.locale
		) {
			this.values.clear();
			this.rows = rows;
			this.columns = columns;
			this.locale = locale;
		}
	}
	matches(row: T, query: string) {
		let text = this.values.get(row);
		if (!text) {
			text = { formatted: [], raw: [] };
			this.values.set(row, text);
		}
		return (
			this.columns?.some((column, index) => {
				text.formatted[index] ??= normalizeSearchText(
					formatValue(row, column, this.locale),
					this.locale,
				);
				if (text.formatted[index].includes(query)) return true;
				text.raw[index] ??= normalizeSearchText(
					String(getCellValue(row, column) ?? ""),
					this.locale,
				);
				return text.raw[index].includes(query);
			}) ?? false
		);
	}
}
export function deriveRows<T>(
	rows: readonly T[],
	columns: readonly Column<T>[],
	state: GridState,
	locale: string,
	searchCache?: SearchTextCache<T>,
): readonly T[] {
	searchCache?.prepare(rows, columns, locale);
	const q = state.search.trim().toLocaleLowerCase(locale);
	const byId = new Map(columns.map((c) => [c.id, c]));
	const tests = Object.entries(state.filters).map(([id, filter]) => {
		const col = byId.get(id);
		if (!col || col.filterable === false) return () => true;
		if (col.filter)
			return (row: T) => col.filter?.(getCellValue(row, col), filter, row);
		if (Array.isArray(filter))
			return (row: T) => filter.includes(String(getCellValue(row, col) ?? ""));
		if (col.type === "number") {
			const test = numericFilter(filter as string);
			if (!test) return () => false;
			return (row: T) => {
				const raw = getCellValue(row, col);
				if (raw == null || raw === "") return false;
				const parsed =
					typeof raw === "number"
						? raw
						: Number(String(raw).trim().replace(/,/g, ""));
				return Number.isFinite(parsed) && test(parsed);
			};
		}
		return (row: T) =>
			String(getCellValue(row, col) ?? "")
				.toLocaleLowerCase(locale)
				.includes(String(filter).toLocaleLowerCase(locale));
	});
	const result = rows.filter(
		(row) =>
			(!q ||
				(searchCache
					? searchCache.matches(row, q)
					: columns.some(
							(col) =>
								formatValue(row, col, locale)
									.toLocaleLowerCase(locale)
									.includes(q) ||
								String(getCellValue(row, col) ?? "")
									.toLocaleLowerCase(locale)
									.includes(q),
						))) &&
			tests.every((test) => test(row)),
	);
	if (!state.sorting.length) return result;
	const collator = new Intl.Collator(locale, {
		numeric: true,
		sensitivity: "base",
	});
	return result.sort((a, b) => {
		for (const sort of state.sorting) {
			const col = byId.get(sort.id);
			if (!col || col.sortable === false) continue;
			const va = getCellValue(a, col);
			const vb = getCellValue(b, col);
			// Empty values stay last in both directions.
			if (va == null || vb == null) {
				if (va == null && vb != null) return 1;
				if (vb == null && va != null) return -1;
				continue;
			}
			const diff = col.compare
				? col.compare(va, vb, a, b)
				: col.type === "number"
					? Number(va) - Number(vb)
					: col.options
						? col.options.indexOf(String(va)) - col.options.indexOf(String(vb))
						: collator.compare(String(va), String(vb));
			if (diff) return sort.direction === "desc" ? -diff : diff;
		}
		return 0;
	});
}
export function parseCell<T>(raw: string, row: T, col: Column<T>): CellValue {
	if (col.parse) return col.parse(raw, row);
	if (raw === "") return col.type === "number" ? null : "";
	if (col.type === "number") return Number(raw.replace(/[$,%]/g, ""));
	if (col.type === "boolean") {
		if (raw === "true" || raw === "1") return true;
		if (raw === "false" || raw === "0") return false;
		throw new Error("Use true or false.");
	}
	return raw;
}
export async function validateCell<T>(
	value: CellValue,
	row: T,
	col: Column<T>,
): Promise<string | undefined> {
	if (value == null || value === "")
		return col.required ? `${col.header} is required.` : undefined;
	if (col.type === "number") {
		if (typeof value !== "number" || !Number.isFinite(value))
			return `${col.header}: enter a finite number.`;
		if (col.integer && !Number.isInteger(value))
			return `${col.header}: enter a whole number.`;
		if (col.min != null && value < col.min)
			return `${col.header}: minimum ${col.min}.`;
		if (col.max != null && value > col.max)
			return `${col.header}: maximum ${col.max}.`;
	}
	if (col.type === "boolean" && typeof value !== "boolean")
		return `${col.header}: use true or false.`;
	if (col.type === "select" && !col.options?.includes(String(value)))
		return `${col.header}: choose a listed option.`;
	if (col.type === "date") {
		const s = String(value);
		const d = new Date(`${s}T00:00:00Z`);
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(s) ||
			!Number.isFinite(d.getTime()) ||
			d.toISOString().slice(0, 10) !== s
		)
			return `${col.header}: use a valid YYYY-MM-DD date.`;
	}
	return col.validate?.(value, row);
}
type SelectionState = Pick<GridState, "selection" | "additionalSelections">;

/** 返回保留区域及最后的活动区域；没有活动区域时视为已取消全部选择。 */
export function selectionRanges(state: SelectionState): readonly CellRange[] {
	if (!state.selection) return [];
	const seen = new Set<string>();
	return [...(state.additionalSelections ?? []), state.selection]
		.reverse()
		.filter((range) => {
			const key = JSON.stringify(
				[range.anchor, range.focus]
					.map((position) =>
						JSON.stringify([position.rowId, position.columnId]),
					)
					.sort(),
			);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.reverse();
}

/**
 * 将所有区域映射到当前可见行列坐标；缺失端点的区域跳过，重叠但不相同的区域保留。
 * @param state 活动区域及可选追加区域，旧单区域状态无需适配。
 * @returns 去除重复矩形后的边界；不扩大区域，也不包含区域之间未选择的单元格。
 */
export function selectionBounds<T>(
	state: SelectionState,
	rows: readonly T[],
	columns: readonly Column<T>[],
	getRowId: (row: T) => string,
	cachedRowIndices?: ReadonlyMap<string, number>,
): readonly { r0: number; r1: number; c0: number; c1: number }[] {
	const ranges = selectionRanges(state);
	if (!ranges.length) return [];
	const rowIndices =
		cachedRowIndices ??
		new Map(rows.map((row, index) => [getRowId(row), index]));
	const columnIndices = new Map(
		columns.map((column, index) => [column.id, index]),
	);
	const seen = new Set<string>();
	return ranges.flatMap((range) => {
		const a = rowIndices.get(range.anchor.rowId);
		const b = rowIndices.get(range.focus.rowId);
		const c = columnIndices.get(range.anchor.columnId);
		const d = columnIndices.get(range.focus.columnId);
		if (
			a === undefined ||
			b === undefined ||
			c === undefined ||
			d === undefined
		)
			return [];
		const bounds = {
			r0: Math.min(a, b),
			r1: Math.max(a, b),
			c0: Math.min(c, d),
			c1: Math.max(c, d),
		};
		const key = `${bounds.r0},${bounds.r1},${bounds.c0},${bounds.c1}`;
		if (seen.has(key)) return [];
		seen.add(key);
		return [bounds];
	});
}

/** 兼容原单区域调用；仅返回当前活动区域在可见行列中的边界。 */
export function rangeBounds<T>(
	state: SelectionState,
	rows: readonly T[],
	columns: readonly Column<T>[],
	getRowId: (row: T) => string,
	cachedRowIndices?: ReadonlyMap<string, number>,
) {
	return (
		selectionBounds(
			{ selection: state.selection },
			rows,
			columns,
			getRowId,
			cachedRowIndices,
		)[0] ?? null
	);
}
export function columnAddress(index: number): string {
	let n = index + 1;
	let s = "";
	while (n > 0) {
		n--;
		s = String.fromCharCode(65 + (n % 26)) + s;
		n = Math.floor(n / 26);
	}
	return s;
}
export function aggregate<T>(rows: readonly T[], col: Column<T>): CellValue {
	if (typeof col.aggregate === "function") return col.aggregate(rows);
	if (col.aggregate === "count") return rows.length;
	const nums = rows
		.map((r) => getCellValue(r, col))
		.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
	if (!nums.length) return null;
	const sum = nums.reduce((a, b) => a + b, 0);
	return col.aggregate === "avg" ? sum / nums.length : sum;
}
const plainNegativeNumber = /^-\d+(?:\.\d+)?$/;
export function safeSpreadsheetValue(value: unknown): string {
	const s = value == null ? "" : String(value);
	if (typeof value !== "string") return s;
	if (plainNegativeNumber.test(s)) return s;
	return /^[\s\uFEFF]*[=+\-@]/.test(s) ? `'${s}` : s;
}
export function stringifyDelimited(
	data: readonly (readonly unknown[])[],
	delimiter = ",",
): string {
	return data
		.map((row) =>
			row
				.map((value) => {
					const s = safeSpreadsheetValue(value);
					return s.includes(delimiter) || /["\r\n]/.test(s)
						? `"${s.replace(/"/g, '""')}"`
						: s;
				})
				.join(delimiter),
		)
		.join("\r\n");
}
export function parseDelimited(text: string, delimiter = "\t"): string[][] {
	const rows: string[][] = [];
	const row: string[] = [];
	let cell = "";
	let quoted = false;
	const input = text.replace(/^\uFEFF/, "");
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (ch === '"') {
			if (quoted && input[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (quoted) {
				quoted = false;
			} else if (!cell) {
				quoted = true;
			} else {
				cell += ch;
			}
		} else if (ch === delimiter && !quoted) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !quoted) {
			if (ch === "\r" && input[i + 1] === "\n") i++;
			row.push(cell);
			rows.push([...row]);
			row.length = 0;
			cell = "";
		} else cell += ch;
	}
	if (quoted) throw new Error("Unclosed quoted field.");
	if (cell || row.length || !rows.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}
