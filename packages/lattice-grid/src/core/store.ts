/**
 * @file Lattice Grid store：泛型表格数据与事务内核。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 版本作用：适配 MIT Lattice Grid 0.1.0-beta.1，保留原始行标识、不可变事务与数据隔离。
 * 被调用：独立表格包的 React 视图；调用：包内核心模块，不依赖业务、数据库或路由。
 * 预期结果：多个表格实例独立工作，外部数据和提交由调用页面管理。
 */

import {
	deriveRows,
	getCellValue,
	parseCell,
	rangeBounds,
	SearchTextCache,
	stringifyDelimited,
	validateCell,
} from "./data";
import type {
	CellPosition,
	Column,
	ColumnState,
	CommitResult,
	GridOptions,
	GridSnapshot,
	GridState,
	Patch,
	Transaction,
} from "./types";

const forbidden = new Set(["__proto__", "prototype", "constructor"]);
type History<T> = {
	before: readonly T[];
	after: readonly T[];
	patches: readonly Patch[];
	deletedIds: readonly string[];
};
export function createGridState<T>(
	columns: readonly Column<T>[],
	initial: Partial<GridState> = {},
): GridState {
	return {
		search: "",
		filters: {},
		sorting: [],
		density: "standard",
		selection: null,
		selectedRows: [],
		...initial,
		columns: columns.map((c) => ({
			id: c.id,
			width: c.width ?? 160,
			hidden: c.hidden ?? false,
			pinned: c.pinned ?? false,
			...initial.columns?.find((s) => s.id === c.id),
		})),
	};
}
export class GridStore<T> {
	private options: GridOptions<T>;
	private rows: readonly T[];
	private state: GridState;
	private listeners = new Set<() => void>();
	private snapshot!: GridSnapshot<T>;
	private past: History<T>[] = [];
	private future: History<T>[] = [];
	private pending = false;
	private error = "";
	private revision = 0;
	private externalRevision = 0;
	private epoch = 0;
	private searchCache = new SearchTextCache<T>();
	private derivedCache?: {
		rows: readonly T[];
		columns: readonly Column<T>[];
		search: string;
		filters: GridState["filters"];
		sorting: GridState["sorting"];
		locale: string;
		result: readonly T[];
	};
	private request?: AbortController;
	constructor(options: GridOptions<T>) {
		this.check(options);
		this.options = options;
		this.rows = options.rows;
		this.state = createGridState(options.columns, options.initialState);
		this.rebuild();
	}
	private check(o: GridOptions<T>) {
		const ids = new Set<string>();
		for (const row of o.rows) {
			const id = o.getRowId(row);
			if (typeof id !== "string" || !id || ids.has(id))
				throw new Error("getRowId must return unique, non-empty strings.");
			ids.add(id);
		}
		ids.clear();
		for (const c of o.columns) {
			if (
				!c.id ||
				ids.has(c.id) ||
				forbidden.has(c.id) ||
				forbidden.has(String(c.field ?? ""))
			)
				throw new Error("Columns require unique, safe IDs and fields.");
			ids.add(c.id);
		}
	}
	getOptions = (): GridOptions<T> => this.options;
	getSnapshot = (): GridSnapshot<T> => this.snapshot;
	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	private rebuild() {
		const state = this.options.state ?? this.state;
		const visible = this.options.columns.filter(
			(c) => !state.columns.find((s) => s.id === c.id)?.hidden,
		);
		const positions = new Map(state.columns.map((c, i) => [c.id, i]));
		visible.sort((a, b) => {
			const pa = state.columns.find((s) => s.id === a.id)?.pinned ?? false;
			const pb = state.columns.find((s) => s.id === b.id)?.pinned ?? false;
			return (
				Number(pb) - Number(pa) ||
				(positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0)
			);
		});
		const locale = this.options.locale ?? "en-US";
		const cache = this.derivedCache;
		let viewRows = this.rows;
		if (this.options.mode !== "server") {
			if (
				cache &&
				cache.rows === this.rows &&
				cache.columns === this.options.columns &&
				cache.search === state.search &&
				cache.filters === state.filters &&
				cache.sorting === state.sorting &&
				cache.locale === locale
			)
				viewRows = cache.result;
			else {
				viewRows = deriveRows(
					this.rows,
					this.options.columns,
					state,
					locale,
					this.searchCache,
				);
				this.derivedCache = {
					rows: this.rows,
					columns: this.options.columns,
					search: state.search,
					filters: state.filters,
					sorting: state.sorting,
					locale,
					result: viewRows,
				};
			}
		}
		this.snapshot = {
			rows: this.rows,
			viewRows,
			columns: visible,
			state,
			pending: this.pending,
			error: this.error,
			canUndo:
				!!this.past.length &&
				!this.options.readOnly &&
				!this.pending &&
				!this.options.loading &&
				!this.options.error,
			canRedo:
				!!this.future.length &&
				!this.options.readOnly &&
				!this.pending &&
				!this.options.loading &&
				!this.options.error,
			externalRevision: this.externalRevision,
			revision: ++this.revision,
		};
	}
	private emit() {
		this.rebuild();
		for (const fn of this.listeners) fn();
	}
	/** Match accepted source cells without treating refreshed readonly calculations as new data. */
	private isDerivedEcho(next: GridOptions<T>) {
		if (
			next.reconcileRows !== "editable" ||
			this.pending ||
			next.rows.length !== this.rows.length
		)
			return false;
		return this.rows.every((row, index) => {
			const incoming = next.rows[index];
			if (!incoming || next.getRowId(incoming) !== this.options.getRowId(row))
				return false;
			return next.columns.every((column) => {
				const canEdit = (candidate: T) =>
					column.editable !== false &&
					(typeof column.editable !== "function" ||
						column.editable(candidate)) &&
					(!column.getValue || !!column.setValue || !!column.field);
				return (
					(!canEdit(row) && !canEdit(incoming)) ||
					Object.is(getCellValue(row, column), getCellValue(incoming, column))
				);
			});
		});
	}
	updateOptions(next: GridOptions<T>) {
		const old = this.options;
		const dataChanged = old.rows !== next.rows && next.rows !== this.rows;
		const identityChanged =
			old.getRowId !== next.getRowId &&
			this.rows.some((row) => old.getRowId(row) !== next.getRowId(row));
		const schemaChanged = old.columns !== next.columns || identityChanged;
		if (dataChanged || schemaChanged) this.check(next);
		const derivedEcho =
			dataChanged && !schemaChanged && this.isDerivedEcho(next);
		this.options = next;
		if (schemaChanged || (dataChanged && !derivedEcho)) this.externalRevision++;
		if (
			(next.readOnly && !old.readOnly) ||
			(next.loading && !old.loading) ||
			(next.error && !old.error)
		) {
			this.request?.abort();
			this.epoch++;
			this.pending = false;
		}
		if (dataChanged) {
			this.request?.abort();
			this.epoch++;
			this.pending = false;
			this.rows = next.rows;
			if (!derivedEcho) {
				this.past = [];
				this.future = [];
			}
		}
		if (schemaChanged) {
			this.request?.abort();
			this.epoch++;
			this.pending = false;
			this.state = createGridState(next.columns, this.state);
			this.past = [];
			this.future = [];
		}
		if (
			dataChanged ||
			schemaChanged ||
			old.state !== next.state ||
			old.locale !== next.locale ||
			old.mode !== next.mode ||
			old.readOnly !== next.readOnly ||
			old.loading !== next.loading ||
			old.error !== next.error ||
			old.totalRows !== next.totalRows
		)
			this.emit();
	}
	setState(patch: Partial<GridState>, reason = "api") {
		const next = { ...this.snapshot.state, ...patch };
		if (!this.options.state) {
			this.state = next;
			this.emit();
		}
		this.options.onStateChange?.(next, reason);
	}
	setColumn(id: string, patch: Partial<Omit<ColumnState, "id">>) {
		let normalized = patch;
		const c = this.options.columns.find((c) => c.id === id);
		if (!c) return;
		if (patch.width != null)
			normalized = {
				...patch,
				width: Math.max(
					c.minWidth ?? 64,
					Math.min(c.maxWidth ?? 800, patch.width),
				),
			};
		this.setState(
			{
				columns: this.snapshot.state.columns.map((s) =>
					s.id === id ? { ...s, ...normalized } : s,
				),
			},
			"columns",
		);
	}
	private columnMoveTarget(id: string, direction: -1 | 1) {
		const { columns, state } = this.snapshot;
		const index = columns.findIndex((column) => column.id === id);
		if (index < 0) return;
		const target = columns[index + direction];
		if (!target) return;
		const sourceState = state.columns.find((column) => column.id === id);
		const targetState = state.columns.find((column) => column.id === target.id);
		if (
			!sourceState ||
			!targetState ||
			sourceState.pinned !== targetState.pinned
		)
			return;
		return target.id;
	}
	/** 菜单仅移动到同一固定区域内相邻的可见列；隐藏列或区域边界返回 false。 */
	canMoveColumn(id: string, direction: -1 | 1): boolean {
		return this.columnMoveTarget(id, direction) !== undefined;
	}
	/** 交换同组的相邻可见列；边界、隐藏或未知列返回 false，且不发布状态变化。 */
	moveColumn(id: string, direction: -1 | 1): boolean {
		const target = this.columnMoveTarget(id, direction);
		if (!target) return false;
		const cols = [...this.snapshot.state.columns];
		const i = cols.findIndex((c) => c.id === id);
		const j = cols.findIndex((c) => c.id === target);
		const from = cols[i];
		const to = cols[j];
		if (!from || !to) return false;
		[cols[i], cols[j]] = [to, from];
		this.setState({ columns: cols }, "columns");
		return true;
	}
	/**
	 * 接收某一固定区域当前可见列的完整排列；重复、遗漏、未知或跨区域 ID 返回 false。
	 * 只替换该组可见列的原有槽位，保留隐藏列、另一组和每列的宽度等状态。
	 */
	reorderVisibleColumns(ids: readonly string[], pinned: boolean): boolean {
		const old = this.snapshot.state.columns;
		const visible = new Set(this.snapshot.columns.map((column) => column.id));
		const group = old.filter(
			(column) => visible.has(column.id) && column.pinned === pinned,
		);
		const byId = new Map(group.map((column) => [column.id, column]));
		if (
			ids.length !== group.length ||
			new Set(ids).size !== group.length ||
			ids.some((id) => !byId.has(id))
		)
			return false;
		if (ids.every((id, index) => id === group[index]?.id)) return true;
		const reordered = [...old];
		let index = 0;
		for (const [position, column] of old.entries()) {
			if (!byId.has(column.id)) continue;
			const id = ids[index++];
			const replacement = id === undefined ? undefined : byId.get(id);
			if (!replacement) return false;
			reordered[position] = replacement;
		}
		this.setState({ columns: reordered }, "columns");
		return true;
	}
	sort(id: string, multi = false, direction?: "asc" | "desc" | "none") {
		const col = this.options.columns.find((c) => c.id === id);
		if (!col || col.sortable === false) return;
		const old = this.snapshot.state.sorting.find((s) => s.id === id);
		const next =
			direction ?? (!old ? "asc" : old.direction === "asc" ? "desc" : "none");
		this.setState(
			{
				sorting: [
					...(multi
						? this.snapshot.state.sorting.filter((s) => s.id !== id)
						: []),
					...(next === "none" ? [] : [{ id, direction: next }]),
				],
			},
			"sorting",
		);
	}
	select(position: CellPosition, extend = false) {
		this.setState(
			{
				selection: {
					anchor:
						extend && this.snapshot.state.selection
							? this.snapshot.state.selection.anchor
							: position,
					focus: position,
				},
			},
			"selection",
		);
	}
	toggleRow(id: string) {
		const ids = new Set(this.snapshot.state.selectedRows);
		ids.has(id) ? ids.delete(id) : ids.add(id);
		this.setState({ selectedRows: [...ids] }, "selectedRows");
	}
	toggleAll() {
		const ids = new Set(this.snapshot.state.selectedRows);
		const view = this.snapshot.viewRows.map(this.options.getRowId);
		const all = view.every((id) => ids.has(id));
		for (const id of view) all ? ids.delete(id) : ids.add(id);
		this.setState({ selectedRows: [...ids] }, "selectedRows");
	}
	isEditable(row: T, col: Column<T>) {
		return (
			!this.options.readOnly &&
			!this.options.loading &&
			!this.options.error &&
			!this.pending &&
			col.editable !== false &&
			(typeof col.editable !== "function" || col.editable(row)) &&
			(!col.getValue || !!col.setValue || !!col.field)
		);
	}
	private report(error: unknown): CommitResult {
		const e = error instanceof Error ? error : new Error(String(error));
		this.error = e.message;
		this.emit();
		this.options.onError?.(e);
		return { ok: false, error: e.message };
	}
	clearError() {
		if (this.error) {
			this.error = "";
			this.emit();
		}
	}
	async apply(
		patches: readonly Patch[],
		source: Transaction<T>["source"] = "api",
	): Promise<CommitResult> {
		if (this.pending)
			return { ok: false, error: "Another transaction is pending." };
		if (this.options.readOnly)
			return this.report(new Error("This grid is read-only."));
		if (!patches.length) return { ok: true };
		const byId = new Map(this.rows.map((r) => [this.options.getRowId(r), r]));
		const columns = new Map(this.options.columns.map((c) => [c.id, c]));
		const normalized = new Map<string, Map<string, Patch>>();
		for (const patch of patches) {
			const row = byId.get(patch.rowId);
			const col = columns.get(patch.columnId);
			if (!row || !col)
				return this.report(
					new Error("The edited row or column no longer exists."),
				);
			if (!this.isEditable(row, col))
				return this.report(new Error(`${col.header} is read-only.`));
			if (!normalized.has(patch.rowId)) normalized.set(patch.rowId, new Map());
			normalized.get(patch.rowId)?.set(patch.columnId, patch);
		}
		const unique = [...normalized.values()].flatMap((m) => [...m.values()]);
		const before = this.rows;
		// Construct a complete candidate first: row validation sees all cells in the transaction.
		const candidate = new Map<string, T>();
		try {
			for (const p of unique) {
				const col = columns.get(p.columnId);
				const row = candidate.get(p.rowId) ?? byId.get(p.rowId);
				if (!col || !row)
					throw new Error("The edited row or column no longer exists.");
				candidate.set(
					p.rowId,
					col.setValue
						? col.setValue(row, p.value)
						: { ...row, [col.field ?? col.id]: p.value },
				);
			}
			for (const [id, row] of candidate)
				if (this.options.getRowId(row) !== id)
					throw new Error("Edits cannot change row identity.");
		} catch (e) {
			return this.report(e);
		}
		const after = before.map(
			(r) => candidate.get(this.options.getRowId(r)) ?? r,
		);
		const tx: Transaction<T> = {
			source,
			patches: unique,
			previousRows: before,
			rows: after,
			deletedIds: [],
		};
		return this.commit(
			tx,
			async () => {
				for (const p of unique) {
					const row = candidate.get(p.rowId);
					const column = columns.get(p.columnId);
					if (!row || !column)
						throw new Error("The edited row or column no longer exists.");
					const error = await validateCell(p.value, row, column);
					if (error) throw new Error(error);
				}
			},
			() => {
				this.pushHistory({ before, after, patches: unique, deletedIds: [] });
			},
		);
	}
	async edit(position: CellPosition, raw: string) {
		const row = this.rows.find(
			(r) => this.options.getRowId(r) === position.rowId,
		);
		const col = this.options.columns.find((c) => c.id === position.columnId);
		if (!row || !col) return this.report(new Error("Cell no longer exists."));
		try {
			return await this.apply(
				[{ ...position, value: parseCell(raw, row, col) }],
				"edit",
			);
		} catch (e) {
			return this.report(e);
		}
	}
	async paste(matrix: readonly (readonly string[])[]): Promise<CommitResult> {
		const { state, viewRows, columns } = this.snapshot;
		const range = rangeBounds(state, viewRows, columns, this.options.getRowId);
		if (!range) return { ok: false, error: "Select a cell before pasting." };
		if (
			matrix.length > viewRows.length - range.r0 ||
			matrix.some((r) => r.length > columns.length - range.c0)
		)
			return this.report(
				new Error(
					"The paste exceeds the visible table. No cells were changed.",
				),
			);
		if (matrix.reduce((n, r) => n + r.length, 0) > 100000)
			return this.report(
				new Error("Paste is limited to 100,000 cells per transaction."),
			);
		const patches: Patch[] = [];
		try {
			for (const [r, cells] of matrix.entries())
				for (const [c, value] of cells.entries()) {
					const row = viewRows[range.r0 + r];
					const col = columns[range.c0 + c];
					if (!row || !col)
						throw new Error("The paste exceeds the visible table.");
					patches.push({
						rowId: this.options.getRowId(row),
						columnId: col.id,
						value: parseCell(value, row, col),
					});
				}
		} catch (e) {
			return this.report(e);
		}
		return this.apply(patches, "paste");
	}
	async clear() {
		const { state, viewRows, columns } = this.snapshot;
		const b = rangeBounds(state, viewRows, columns, this.options.getRowId);
		if (!b) return { ok: true };
		const patches: Patch[] = [];
		for (const row of viewRows.slice(b.r0, b.r1 + 1))
			for (const column of columns.slice(b.c0, b.c1 + 1))
				patches.push({
					rowId: this.options.getRowId(row),
					columnId: column.id,
					value: column.type === "number" ? null : "",
				});
		return this.apply(patches, "clear");
	}
	/** Insert validated rows at an index in the underlying data, not in sorted view order. */
	async insertRows(
		newRows: readonly T[],
		at = this.rows.length,
	): Promise<CommitResult> {
		if (!newRows.length) return { ok: true };
		if (!Number.isInteger(at) || at < 0 || at > this.rows.length)
			return this.report(new Error("Insert index is outside the data."));
		const before = this.rows;
		const after = [...before.slice(0, at), ...newRows, ...before.slice(at)];
		try {
			this.check({ ...this.options, rows: after });
		} catch (e) {
			return this.report(e);
		}
		return this.commit(
			{
				source: "insert",
				patches: [],
				previousRows: before,
				rows: after,
				deletedIds: [],
			},
			async () => {
				for (const row of newRows)
					for (const col of this.options.columns) {
						const error = await validateCell(getCellValue(row, col), row, col);
						if (error) throw new Error(error);
					}
			},
			() => this.pushHistory({ before, after, patches: [], deletedIds: [] }),
		);
	}
	reorderColumns(ids: readonly string[]): boolean {
		const old = this.snapshot.state.columns;
		if (
			ids.length !== old.length ||
			new Set(ids).size !== old.length ||
			ids.some((id) => !old.some((c) => c.id === id))
		)
			return false;
		const positions = new Map(ids.map((id, index) => [id, index]));
		this.setState(
			{
				columns: [...old].sort(
					(a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0),
				),
			},
			"columns",
		);
		return true;
	}
	async deleteRows(ids: readonly string[] = this.snapshot.state.selectedRows) {
		if (!this.options.allowDelete || this.options.readOnly)
			return this.report(new Error("Row deletion is disabled."));
		const set = new Set(ids);
		const before = this.rows;
		const after = before.filter((r) => !set.has(this.options.getRowId(r)));
		if (before.length === after.length) return { ok: true };
		return this.commit(
			{
				source: "delete",
				patches: [],
				previousRows: before,
				rows: after,
				deletedIds: ids,
			},
			async () => {},
			() => {
				this.pushHistory({ before, after, patches: [], deletedIds: ids });
				this.setState({ selectedRows: [], selection: null }, "delete");
			},
		);
	}
	private pushHistory(entry: History<T>) {
		const limit = this.options.historyLimit ?? 50;
		this.past = limit > 0 ? [...this.past, entry].slice(-limit) : [];
		this.future = [];
	}
	private async commit(
		tx: Transaction<T>,
		validate: () => Promise<void>,
		onSuccess: () => void,
	): Promise<CommitResult> {
		if (this.pending)
			return { ok: false, error: "Another transaction is pending." };
		if (this.options.readOnly)
			return this.report(new Error("This grid is read-only."));
		if (this.options.loading || this.options.error)
			return this.report(
				new Error("Wait until data is available before changing it."),
			);
		const epoch = this.epoch;
		const controller = new AbortController();
		this.request = controller;
		this.pending = true;
		this.error = "";
		this.emit();
		try {
			await validate();
			if (controller.signal.aborted || epoch !== this.epoch)
				return { ok: false, error: "Data changed during validation." };
			await this.options.onCommit?.(tx, { signal: controller.signal });
			if (controller.signal.aborted || epoch !== this.epoch)
				return { ok: false, error: "Data changed during saving." };
			this.rows = tx.rows;
			onSuccess();
			this.pending = false;
			this.request = undefined;
			this.emit();
			try {
				this.options.onRowsChange?.(this.rows, tx);
			} catch (e) {
				this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
			}
			return { ok: true };
		} catch (e) {
			if (controller.signal.aborted)
				return { ok: false, error: "Transaction canceled." };
			this.pending = false;
			this.request = undefined;
			return this.report(e);
		}
	}
	/** Reapply history cells to the current derived rows; default snapshot semantics stay intact. */
	private historyTransaction(
		entry: History<T>,
		direction: "undo" | "redo",
	): Transaction<T> {
		const target = direction === "undo" ? entry.before : entry.after;
		const beforeById = new Map(
			entry.before.map((row) => [this.options.getRowId(row), row]),
		);
		const columns = new Map(
			this.options.columns.map((column) => [column.id, column]),
		);
		const patches =
			direction === "redo"
				? entry.patches
				: entry.patches.map((patch) => {
						const row = beforeById.get(patch.rowId);
						const column = columns.get(patch.columnId);
						if (!row || !column)
							throw new Error("History cell no longer exists.");
						return { ...patch, value: getCellValue(row, column) };
					});
		let rows = target;
		if (this.options.reconcileRows === "editable") {
			const current = new Map(
				this.rows.map((row) => [this.options.getRowId(row), row]),
			);
			const patched = new Map<string, T>();
			for (const patch of patches) {
				const row = patched.get(patch.rowId) ?? current.get(patch.rowId);
				const column = columns.get(patch.columnId);
				if (!row || !column) throw new Error("History cell no longer exists.");
				patched.set(
					patch.rowId,
					column.setValue
						? column.setValue(row, patch.value)
						: { ...row, [column.field ?? column.id]: patch.value },
				);
			}
			rows = target.map((row) => {
				const id = this.options.getRowId(row);
				return patched.get(id) ?? current.get(id) ?? row;
			});
		}
		const targetIds = new Set(rows.map(this.options.getRowId));
		return {
			source: direction,
			patches,
			previousRows: this.rows,
			rows,
			deletedIds: this.rows
				.map(this.options.getRowId)
				.filter((id) => !targetIds.has(id)),
		};
	}
	undo = async () => {
		const h = this.past.at(-1);
		if (!h || this.pending || this.options.readOnly) return { ok: false };
		let transaction: Transaction<T>;
		try {
			transaction = this.historyTransaction(h, "undo");
		} catch (error) {
			return this.report(error);
		}
		return this.commit(
			transaction,
			async () => {},
			() => {
				this.past.pop();
				this.future.push(h);
			},
		);
	};
	redo = async () => {
		const h = this.future.at(-1);
		if (!h || this.pending || this.options.readOnly) return { ok: false };
		let transaction: Transaction<T>;
		try {
			transaction = this.historyTransaction(h, "redo");
		} catch (error) {
			return this.report(error);
		}
		return this.commit(
			transaction,
			async () => {},
			() => {
				this.future.pop();
				this.past.push(h);
			},
		);
	};
	exportCSV(selectedOnly = false) {
		const { viewRows, columns, state } = this.snapshot;
		const ids = new Set(state.selectedRows);
		const rows = selectedOnly
			? viewRows.filter((r) => ids.has(this.options.getRowId(r)))
			: viewRows;
		return (
			"\uFEFF" +
			stringifyDelimited([
				columns.map((c) => c.header),
				...rows.map((r) => columns.map((c) => getCellValue(r, c))),
			])
		);
	}
	copySelection() {
		const { viewRows, columns, state } = this.snapshot;
		const b = rangeBounds(state, viewRows, columns, this.options.getRowId);
		return b
			? stringifyDelimited(
					viewRows
						.slice(b.r0, b.r1 + 1)
						.map((r) =>
							columns.slice(b.c0, b.c1 + 1).map((c) => getCellValue(r, c)),
						),
					"\t",
				)
			: "";
	}
	/** Explicit opt-in. No row values or selection are serialized. */
	saveView() {
		const { search, sorting, filters, columns, density } = this.snapshot.state;
		return JSON.stringify({
			version: 1,
			search,
			sorting,
			filters,
			columns,
			density,
		});
	}
	restoreView(json: string): boolean {
		try {
			const v = JSON.parse(json);
			const ids = new Set(this.options.columns.map((c) => c.id));
			if (
				v.version !== 1 ||
				typeof v.search !== "string" ||
				!["compact", "standard", "comfortable"].includes(v.density) ||
				!Array.isArray(v.columns) ||
				!Array.isArray(v.sorting) ||
				!v.filters ||
				typeof v.filters !== "object" ||
				Array.isArray(v.filters)
			)
				return false;
			const filters: Record<string, string | readonly string[]> = {};
			for (const [k, f] of Object.entries(v.filters))
				if (
					ids.has(k) &&
					(typeof f === "string" ||
						(Array.isArray(f) && f.every((x) => typeof x === "string")))
				)
					filters[k] = f as string | string[];
			const seen = new Set<string>();
			const cols: ColumnState[] = [];
			for (const s of v.columns) {
				if (
					!ids.has(s.id) ||
					seen.has(s.id) ||
					!Number.isFinite(s.width) ||
					typeof s.hidden !== "boolean" ||
					typeof s.pinned !== "boolean"
				)
					return false;
				seen.add(s.id);
				const def = this.options.columns.find((c) => c.id === s.id);
				if (!def) return false;
				cols.push({
					id: s.id,
					width: Math.max(
						def.minWidth ?? 64,
						Math.min(def.maxWidth ?? 800, s.width),
					),
					hidden: s.hidden,
					pinned: s.pinned,
				});
			}
			for (const s of createGridState(this.options.columns).columns)
				if (!seen.has(s.id)) cols.push(s);
			this.setState(
				{
					search: v.search,
					filters,
					density: v.density,
					columns: cols,
					sorting: v.sorting.filter(
						(s: { id: string; direction: string }) =>
							ids.has(s.id) && ["asc", "desc"].includes(s.direction),
					),
					selection: null,
				},
				"restore",
			);
			return true;
		} catch {
			return false;
		}
	}
	resetView() {
		this.setState(
			createGridState(this.options.columns, this.options.initialState),
			"reset",
		);
	}
	cancelPending() {
		this.request?.abort();
		this.request = undefined;
		this.epoch++;
		this.pending = false;
		this.emit();
	}
	destroy() {
		this.request?.abort();
		this.epoch++;
		this.listeners.clear();
	}
}
export const createGrid = <T>(options: GridOptions<T>) =>
	new GridStore(options);
