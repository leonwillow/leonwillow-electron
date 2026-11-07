/**
 * @file Lattice Grid 的虚拟行、键盘、选区与剪贴板控制器。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 版本作用：保留原控制器契约，适配共享主题和 ScrollArea 的实际 viewport。
 * 被调用：React DataGrid；调用：泛型 GridStore、浏览器 DOM；仅 mount 后读取布局。
 * 预期结果：导航、选区与编辑定位始终使用相同几何数据，不介入业务持久化。
 */

import {
	aggregate,
	columnAddress,
	getCellValue,
	parseDelimited,
	rangeBounds,
} from "./core/data";
import { enUS } from "./core/messages";
import type { GridStore } from "./core/store";
import type {
	CellPosition,
	CellValue,
	Column,
	GridState,
	Messages,
} from "./core/types";
import { virtualRange } from "./virtual-range";
export interface CellContext<T> {
	row: T;
	column: Column<T>;
	value: unknown;
	rowIndex: number;
	selected: boolean;
}
export interface EditorContext<T> extends CellContext<T> {
	initialValue: string;
	/** 自定义编辑器同步草稿，供点击外部时提交；portal 根节点标记 data-lg-edit-scope。 */
	onValueChange: (value: string) => void;
	editScope: string;
	commit: (value: string) => Promise<boolean>;
	cancel: () => void;
}
export interface ViewOptions<T> {
	id: string;
	label?: string;
	height?: number;
	overscan?: number;
	virtualize?: boolean;
	messages?: Partial<Messages>;
	className?: string;
	style?: Record<string, string | number>;
	toolbar?: boolean;
	summary?: boolean;
	statusBar?: boolean;
	renderCell?: (context: CellContext<T>) => unknown;
	renderEditor?: (context: EditorContext<T>) => unknown;
	renderToolbar?: (store: GridStore<T>) => unknown;
	renderEmpty?: () => unknown;
	exportable?: boolean;
	onExport?: (csv: string) => void;
	filename?: string;
	formatError?: (message: string) => string;
}
export type Popup = {
	kind: "columns" | "density" | "column" | "filter";
	id?: string;
	x: number;
	y: number;
};
export interface ViewState {
	start: number;
	end: number;
	width: number;
	showFilters: boolean;
	popup: Popup | null;
	editing: CellPosition | null;
	draft: string;
	notice: string;
	scrollX: boolean;
}
export class GridView<T> {
	store: GridStore<T>;
	options: ViewOptions<T>;
	root: HTMLElement | null = null;
	scroller: HTMLElement | null = null;
	private snapshot: ViewState = {
		start: 0,
		end: 25,
		width: 940,
		showFilters: false,
		popup: null,
		editing: null,
		draft: "",
		notice: "",
		scrollX: false,
	};
	private listeners = new Set<() => void>();
	private resizeObserver?: ResizeObserver;
	private themeObserver?: MutationObserver;
	private geometry = "";
	private timer: ReturnType<typeof setTimeout> | undefined;
	private focusTimer: ReturnType<typeof setTimeout> | undefined;
	private editExternalRevision = 0;
	private editSession = 0;
	private editInitialDraft = "";
	private popupTrigger: HTMLElement | null = null;
	private drag:
		| { type: "select" }
		| { type: "resize"; columnId: string; x: number; width: number }
		| null = null;
	private cleanStore?: () => void;
	private statsCache?: {
		rows: readonly T[];
		selection: GridState["selection"];
		columnIds: string;
		stats: { count: number; sum: number; numericCount: number };
	};
	private rowIndexCache?: { rows: readonly T[]; index: Map<string, number> };
	rowIndex(id: string) {
		const rows = this.store.getSnapshot().viewRows;
		if (this.rowIndexCache?.rows !== rows)
			this.rowIndexCache = {
				rows,
				index: new Map(
					rows.map((row, i) => [this.store.getOptions().getRowId(row), i]),
				),
			};
		return this.rowIndexCache.index.get(id) ?? -1;
	}
	private totalsCache?: {
		rows: readonly T[];
		values: Map<Column<T>, CellValue>;
	};
	stats() {
		const { state, viewRows, columns } = this.store.getSnapshot();
		const columnIds = columns.map((c) => c.id).join("\0");
		const cache = this.statsCache;
		if (
			cache &&
			cache.rows === viewRows &&
			cache.selection === state.selection &&
			cache.columnIds === columnIds
		)
			return cache.stats;
		const b = rangeBounds(
			state,
			viewRows,
			columns,
			this.store.getOptions().getRowId,
		);
		let count = 0;
		let sum = 0;
		let numericCount = 0;
		if (b)
			for (const row of viewRows.slice(b.r0, b.r1 + 1))
				for (const column of columns.slice(b.c0, b.c1 + 1)) {
					count++;
					const value = getCellValue(row, column);
					if (typeof value === "number" && Number.isFinite(value)) {
						numericCount++;
						sum += value;
					}
				}
		const stats = { count, sum, numericCount };
		this.statsCache = {
			rows: viewRows,
			selection: state.selection,
			columnIds,
			stats,
		};
		return stats;
	}
	total(col: Column<T>) {
		const rows = this.store.getSnapshot().viewRows;
		if (this.totalsCache?.rows !== rows)
			this.totalsCache = { rows, values: new Map() };
		if (!this.totalsCache.values.has(col))
			this.totalsCache.values.set(col, aggregate(rows, col));
		return this.totalsCache.values.get(col);
	}

	constructor(store: GridStore<T>, options: ViewOptions<T>) {
		this.store = store;
		this.options = options;
	}
	getSnapshot = () => this.snapshot;
	subscribe = (fn: () => void) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};
	update(options: ViewOptions<T>) {
		this.options = options;
	}
	messages() {
		return { ...enUS, ...this.options.messages };
	}
	set(patch: Partial<ViewState>) {
		this.snapshot = { ...this.snapshot, ...patch };
		for (const fn of this.listeners) fn();
	}
	/** 共享 CSS 使用 rem；虚拟布局换算为当前根字号的实际像素。 */
	metric(name: string, fallback: number) {
		const win = this.root?.ownerDocument.defaultView;
		if (!win || !this.root) return fallback;
		const value = win.getComputedStyle(this.root).getPropertyValue(name).trim();
		const number = Number.parseFloat(value);
		if (!Number.isFinite(number) || number <= 0) return fallback;
		return value.endsWith("rem")
			? number *
					Number.parseFloat(
						win.getComputedStyle(this.root.ownerDocument.documentElement)
							.fontSize,
					)
			: number;
	}
	rowHeight() {
		const density = this.store.getSnapshot().state.density;
		return this.metric(
			`--lg-row-${density}`,
			{ compact: 28, standard: 32, comfortable: 40 }[density],
		);
	}
	gutterWidth() {
		return this.metric("--lg-gutter-width", 48);
	}
	summaryHeight() {
		return this.options.summary === false
			? 0
			: this.metric("--lg-summary-height", 36);
	}
	headerHeight() {
		const density = this.store.getSnapshot().state.density;
		return this.metric(
			`--lg-header-${density}`,
			{ compact: 28, standard: 32, comfortable: 40 }[density],
		);
	}
	groupHeaderHeight() {
		const density = this.store.getSnapshot().state.density;
		return this.store.getSnapshot().columns.some((column) => column.group)
			? this.metric(
					`--lg-group-header-${density}`,
					{ compact: 28, standard: 32, comfortable: 40 }[density],
				)
			: 0;
	}
	filterHeight() {
		return Math.max(
			this.headerHeight(),
			this.metric("--lg-filter-min-height", 40),
		);
	}
	headHeight() {
		return (
			this.headerHeight() +
			(this.snapshot.showFilters ? this.filterHeight() : 0) +
			this.groupHeaderHeight()
		);
	}

	mount() {
		// Data lifecycle stays active without DOM nodes, making controller state independently testable.
		this.cleanStore = this.store.subscribe(() => {
			this.reconcileEditor();
			this.measure();
		});
		const cleanStore = this.cleanStore;
		const cleanData = () => {
			cleanStore();
			clearTimeout(this.timer);
			clearTimeout(this.focusTimer);
			this.editSession++;
		};
		if (!this.root || !this.scroller) return cleanData;
		const win = this.root.ownerDocument.defaultView;
		if (!win) return cleanData;
		const doc = this.root.ownerDocument;
		this.resizeObserver = new win.ResizeObserver(() => this.measure());
		this.resizeObserver.observe(this.scroller);
		// A root rem-scale change can leave a fixed viewport unchanged but alters every virtual row.
		this.themeObserver = new win.MutationObserver(() => this.measure());
		this.themeObserver.observe(doc.documentElement, { attributes: true });
		doc.addEventListener("pointerdown", this.outside, true);
		doc.addEventListener("focusin", this.focusOutside, true);
		doc.addEventListener("pointermove", this.pointerMove);
		doc.addEventListener("pointerup", this.pointerUp);
		doc.addEventListener("pointercancel", this.pointerCancel);
		this.measure();
		return () => {
			this.resizeObserver?.disconnect();
			this.themeObserver?.disconnect();
			cleanData();
			doc.removeEventListener("pointerdown", this.outside, true);
			doc.removeEventListener("focusin", this.focusOutside, true);
			doc.removeEventListener("pointermove", this.pointerMove);
			doc.removeEventListener("pointerup", this.pointerUp);
			doc.removeEventListener("pointercancel", this.pointerCancel);
			this.drag = null;
		};
	}
	measure = () => {
		if (!this.scroller) return;
		const count = this.store.getSnapshot().viewRows.length;
		const overscan = this.options.overscan ?? 8;
		const h = this.rowHeight();
		const max = Math.max(
			0,
			count * h +
				this.headHeight() +
				this.summaryHeight() -
				this.scroller.clientHeight,
		);
		if (this.scroller.scrollTop > max) this.scroller.scrollTop = max;
		const { start, end } = virtualRange(
			count,
			h,
			this.scroller.scrollTop,
			this.scroller.clientHeight - this.headHeight() - this.summaryHeight(),
			this.snapshot,
			overscan,
			this.options.virtualize !== false,
		);
		const width = this.scroller.clientWidth || 940;
		const scrollX = this.scroller.scrollLeft > 0;
		const geometry = [
			h,
			this.headHeight(),
			this.summaryHeight(),
			this.gutterWidth(),
		].join(":");
		if (
			geometry !== this.geometry ||
			start !== this.snapshot.start ||
			end !== this.snapshot.end ||
			width !== this.snapshot.width ||
			scrollX !== this.snapshot.scrollX
		) {
			this.geometry = geometry;
			this.set({ start, end, width, scrollX });
		}
	};
	// 滚动事件中同步发布窗口，避免额外 rAF 延迟后 React 才开始渲染。
	onScroll = () => this.measure();
	announce(message: string) {
		clearTimeout(this.timer);
		this.set({ notice: message });
		this.timer = setTimeout(() => this.set({ notice: "" }), 4000);
	}
	focusGrid() {
		this.scroller?.focus({ preventScroll: true });
	}
	focusEditor(selectAll = true) {
		clearTimeout(this.focusTimer);
		this.focusTimer = setTimeout(() => {
			const el = this.root?.querySelector<HTMLInputElement>("[data-lg-editor]");
			el?.focus({ preventScroll: true });
			if (selectAll) el?.select?.();
		}, 0);
	}
	togglePopup(kind: Popup["kind"], event: Event, id?: string) {
		const target = event.currentTarget as HTMLElement;
		if (this.snapshot.popup?.kind === kind && this.snapshot.popup?.id === id) {
			this.closePopup();
			return;
		}
		if (!this.root) return;
		const rect = target.getBoundingClientRect();
		const root = this.root.getBoundingClientRect();
		this.popupTrigger = target;
		this.set({
			popup: {
				kind,
				id,
				x: Math.max(8, Math.min(rect.left - root.left, root.width - 280)),
				y: rect.bottom - root.top + 7,
			},
		});
		this.focusTimer = setTimeout(
			() =>
				this.root
					?.querySelector<HTMLElement>(".lg-popup button,.lg-popup input")
					?.focus(),
			0,
		);
	}
	closePopup(restore = true) {
		this.set({ popup: null });
		if (restore) this.popupTrigger?.focus({ preventScroll: true });
	}
	private outside = (event: PointerEvent) => {
		this.focusOutside(event);
		if (
			this.snapshot.popup &&
			!this.root?.querySelector(".lg-popup")?.contains(event.target as Node) &&
			!this.popupTrigger?.contains(event.target as Node)
		)
			this.closePopup(false);
	};
	private focusOutside = (event: Event) => {
		if (!this.snapshot.editing) return;
		const target = event.target as Element | null;
		if (
			this.root?.querySelector(".lg-editing")?.contains(target) ||
			target
				?.closest?.("[data-lg-edit-scope]")
				?.getAttribute("data-lg-edit-scope") === this.options.id
		)
			return;
		void this.leaveEdit();
	};
	/** Host data/permissions can invalidate a draft; pending own commits and derived echoes cannot. */
	private reconcileEditor() {
		const position = this.snapshot.editing;
		if (!position) return;
		const snapshot = this.store.getSnapshot();
		const options = this.store.getOptions();
		const row = snapshot.rows.find(
			(candidate) => options.getRowId(candidate) === position.rowId,
		);
		const column = snapshot.columns.find(
			(candidate) => candidate.id === position.columnId,
		);
		const allowed =
			row &&
			column &&
			column.editable !== false &&
			(typeof column.editable !== "function" || column.editable(row)) &&
			(!column.getValue || !!column.setValue || !!column.field);
		if (
			!allowed ||
			options.readOnly ||
			options.loading ||
			options.error ||
			snapshot.externalRevision !== this.editExternalRevision
		) {
			const editor = this.root?.querySelector<HTMLElement>("[data-lg-editor]");
			const restoreFocus = !!editor?.contains(
				this.root?.ownerDocument.activeElement ?? null,
			);
			this.editSession++;
			clearTimeout(this.focusTimer);
			this.set({ editing: null, draft: "" });
			this.store.clearError();
			if (restoreFocus) this.focusGrid();
		}
	}
	startEdit(pos: CellPosition, initial?: string) {
		const row = this.store
			.getSnapshot()
			.viewRows.find((r) => this.store.getOptions().getRowId(r) === pos.rowId);
		const col = this.store
			.getOptions()
			.columns.find((c) => c.id === pos.columnId);
		if (!row || !col || !this.store.isEditable(row, col)) return;
		this.store.clearError();
		this.editExternalRevision = this.store.getSnapshot().externalRevision;
		this.editSession++;
		const value = getCellValue(row, col);
		this.editInitialDraft = col.formatEdit?.(value, row) ?? String(value ?? "");
		this.set({
			editing: pos,
			draft: initial ?? this.editInitialDraft,
		});
		this.focusEditor(initial === undefined);
	}
	cancelEdit(restoreFocus = true) {
		this.editSession++;
		clearTimeout(this.focusTimer);
		this.set({ editing: null, draft: "" });
		this.store.clearError();
		if (restoreFocus) this.focusGrid();
	}
	/** 离开立即关闭编辑并保留目标焦点；有效改动提交一次，失败保留原值并由宿主提示。 */
	async leaveEdit() {
		const { editing, draft } = this.snapshot;
		if (!editing) return true;
		const changed = draft !== this.editInitialDraft;
		const pending = this.store.getSnapshot().pending;
		this.cancelEdit(false);
		// 已经通过 Enter/Tab 发出的事务继续完成，不重复提交或拉回焦点。
		if (!changed || pending) return true;
		return (await this.store.edit(editing, draft)).ok;
	}
	async commitEdit(raw = this.snapshot.draft) {
		const pos = this.snapshot.editing;
		if (!pos) return true;
		if (this.store.getSnapshot().pending) return false;
		if (raw === this.editInitialDraft) {
			this.cancelEdit();
			return true;
		}
		const session = this.editSession;
		const result = await this.store.edit(pos, raw);
		// An old request must not close or refocus an editor opened after host invalidation.
		if (session !== this.editSession) return false;
		if (result.ok) {
			this.set({ editing: null, draft: "" });
			this.focusGrid();
		} else this.focusEditor();
		return result.ok;
	}
	select(pos: CellPosition, extend = false) {
		this.store.select(pos, extend);
		this.focusGrid();
	}
	startSelection(event: PointerEvent, pos: CellPosition) {
		if (event.button !== 0 || this.snapshot.editing) return;
		if (
			(event.target as HTMLElement).closest(
				"button,input,select,a,[data-lg-interactive]",
			)
		)
			return;
		this.select(pos, event.shiftKey);
		if (event.pointerType !== "touch") {
			event.preventDefault();
			this.drag = { type: "select" };
		}
	}
	startResize(event: PointerEvent, id: string) {
		event.preventDefault();
		event.stopPropagation();
		const c = this.store.getSnapshot().state.columns.find((c) => c.id === id);
		this.drag = {
			type: "resize",
			columnId: id,
			x: event.clientX,
			width: c?.width ?? 160,
		};
	}
	private pointerMove = (e: PointerEvent) => {
		if (!this.drag || !this.scroller) return;
		if (this.drag.type === "resize") {
			this.store.setColumn(this.drag.columnId, {
				width: this.drag.width + e.clientX - this.drag.x,
			});
			return;
		}
		const rect = this.scroller.getBoundingClientRect();
		if (e.clientY < rect.top + this.headHeight() + 16)
			this.scroller.scrollTop -= this.rowHeight();
		if (e.clientY > rect.bottom - this.summaryHeight())
			this.scroller.scrollTop += this.rowHeight();
		if (e.clientX > rect.right - 24) this.scroller.scrollLeft += 24;
		if (e.clientX < rect.left + 24) this.scroller.scrollLeft -= 24;
		const el = this.root?.ownerDocument
			.elementFromPoint(e.clientX, e.clientY)
			?.closest<HTMLElement>("[data-lg-cell]");
		if (!el || !this.root?.contains(el)) return;
		const row = Number(el.dataset.row);
		const col = el.dataset.col;
		if (!col) return;
		const rows = this.store.getSnapshot().viewRows;
		if (rows[row]) {
			const pos = {
				rowId: this.store.getOptions().getRowId(rows[row]),
				columnId: col,
			};
			const focus = this.store.getSnapshot().state.selection?.focus;
			if (focus?.rowId !== pos.rowId || focus.columnId !== pos.columnId)
				this.store.select(pos, true);
		}
	};
	private pointerUp = () => {
		this.drag = null;
	};
	private pointerCancel = () => {
		this.drag = null;
	};
	ensureVisible(rowIndex: number, columnIndex: number) {
		if (!this.scroller) return;
		const h = this.rowHeight();
		const top = rowIndex * h;
		if (top < this.scroller.scrollTop) this.scroller.scrollTop = top;
		else if (
			top + h >
			this.scroller.scrollTop +
				this.scroller.clientHeight -
				this.headHeight() -
				this.summaryHeight()
		)
			this.scroller.scrollTop =
				top +
				h -
				this.scroller.clientHeight +
				this.headHeight() +
				this.summaryHeight();
		const cols = this.layout();
		const col = cols[columnIndex];
		if (col && !col.pinned) {
			const frozen =
				this.gutterWidth() +
				cols.filter((c) => c.pinned).reduce((n, c) => n + c.width, 0);
			if (col.left < this.scroller.scrollLeft + frozen)
				this.scroller.scrollLeft = col.left - frozen;
			else if (
				col.left + col.width >
				this.scroller.scrollLeft + this.scroller.clientWidth
			)
				this.scroller.scrollLeft =
					col.left + col.width - this.scroller.clientWidth;
		}
		this.measure();
	}
	move(dr: number, dc: number, extend = false, absolute?: "start" | "end") {
		const { state, viewRows, columns } = this.store.getSnapshot();
		if (!viewRows.length || !columns.length) return;
		const focus = state.selection?.focus;
		let r = Math.max(
			0,
			viewRows.findIndex(
				(row) => this.store.getOptions().getRowId(row) === focus?.rowId,
			),
		);
		let c = Math.max(
			0,
			columns.findIndex((col) => col.id === focus?.columnId),
		);
		r = Math.max(0, Math.min(viewRows.length - 1, r + dr));
		c = Math.max(0, Math.min(columns.length - 1, c + dc));
		if (absolute === "start") {
			r = 0;
			c = 0;
		}
		if (absolute === "end") {
			r = viewRows.length - 1;
			c = columns.length - 1;
		}
		const row = viewRows[r];
		const column = columns[c];
		if (!row || !column) return;
		this.store.select(
			{
				rowId: this.store.getOptions().getRowId(row),
				columnId: column.id,
			},
			extend,
		);
		this.ensureVisible(r, c);
	}
	onKeyDown = (event: KeyboardEvent) => {
		if (
			(event.target as HTMLElement).closest(
				"input,select,textarea,button,[data-lg-interactive]",
			)
		)
			return;
		const mod = event.metaKey || event.ctrlKey;
		if (mod && event.key.toLowerCase() === "z") {
			event.preventDefault();
			void (event.shiftKey ? this.store.redo() : this.store.undo());
			return;
		}
		if (mod && event.key.toLowerCase() === "y") {
			event.preventDefault();
			void this.store.redo();
			return;
		}
		if (mod && event.key.toLowerCase() === "a") {
			event.preventDefault();
			const { viewRows, columns } = this.store.getSnapshot();
			const firstRow = viewRows[0];
			const lastRow = viewRows.at(-1);
			const firstColumn = columns[0];
			const lastColumn = columns.at(-1);
			if (firstRow && lastRow && firstColumn && lastColumn)
				this.store.setState(
					{
						selection: {
							anchor: {
								rowId: this.store.getOptions().getRowId(firstRow),
								columnId: firstColumn.id,
							},
							focus: {
								rowId: this.store.getOptions().getRowId(lastRow),
								columnId: lastColumn.id,
							},
						},
					},
					"selection",
				);
			return;
		}
		const directions: Record<string, [number, number]> = {
			ArrowUp: [-1, 0],
			ArrowDown: [1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1],
			Tab: [0, event.shiftKey ? -1 : 1],
			PageDown: [
				Math.max(
					1,
					Math.floor(
						(this.scroller?.clientHeight ?? this.options.height ?? 440) /
							this.rowHeight(),
					) - 2,
				),
				0,
			],
			PageUp: [
				-Math.max(
					1,
					Math.floor(
						(this.scroller?.clientHeight ?? this.options.height ?? 440) /
							this.rowHeight(),
					) - 2,
				),
				0,
			],
		};
		if (event.key === "Tab") {
			const { state, columns } = this.store.getSnapshot();
			const i = columns.findIndex(
				(c) => c.id === state.selection?.focus.columnId,
			);
			if (event.shiftKey ? i <= 0 : i >= columns.length - 1) return;
		}
		const direction = directions[event.key];
		if (direction) {
			event.preventDefault();
			this.move(...direction, event.shiftKey && event.key !== "Tab");
			return;
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			this.move(
				0,
				event.key === "Home"
					? Number.NEGATIVE_INFINITY
					: Number.POSITIVE_INFINITY,
				event.shiftKey,
				mod ? (event.key === "Home" ? "start" : "end") : undefined,
			);
			return;
		}
		if (event.key === "Escape") {
			this.store.setState({ selection: null }, "selection");
			return;
		}
		if (event.key === "Delete" || event.key === "Backspace") {
			event.preventDefault();
			void this.store.clear();
			return;
		}
		const focus = this.store.getSnapshot().state.selection?.focus;
		if (
			focus &&
			(event.key === "Enter" ||
				event.key === "F2" ||
				(!mod && !event.altKey && !event.isComposing && event.key.length === 1))
		) {
			event.preventDefault();
			this.startEdit(focus, event.key.length === 1 ? event.key : undefined);
		}
	};
	onCopy = (event: ClipboardEvent) => {
		if (
			this.snapshot.editing ||
			(event.target as HTMLElement).closest("input,textarea")
		)
			return;
		const text = this.store.copySelection();
		if (text) {
			event.clipboardData?.setData("text/plain", text);
			event.preventDefault();
			this.announce(this.messages().copied);
		}
	};
	onPaste = (event: ClipboardEvent) => {
		if (
			this.snapshot.editing ||
			(event.target as HTMLElement).closest("input,textarea")
		)
			return;
		event.preventDefault();
		try {
			void this.store.paste(
				parseDelimited(event.clipboardData?.getData("text/plain") ?? ""),
			);
		} catch (e) {
			const message = String(e);
			this.announce(this.options.formatError?.(message) ?? message);
		}
	};
	async copy() {
		try {
			await this.root?.ownerDocument.defaultView?.navigator.clipboard.writeText(
				this.store.copySelection(),
			);
			this.announce(this.messages().copied);
		} catch {
			this.announce(this.messages().clipboardUnavailable);
		}
	}
	export() {
		const csv = this.store.exportCSV(
			this.store.getSnapshot().state.selectedRows.length > 0,
		);
		if (this.options.onExport) {
			this.options.onExport(csv);
			return;
		}
		const doc = this.root?.ownerDocument;
		const win = doc?.defaultView;
		if (!doc || !win) return;
		const url = win.URL.createObjectURL(
			new Blob([csv], { type: "text/csv;charset=utf-8" }),
		);
		const a = doc.createElement("a");
		a.href = url;
		a.download = this.options.filename ?? "grid.csv";
		a.click();
		setTimeout(() => win.URL.revokeObjectURL(url), 1000);
	}
	layout() {
		const { columns, state } = this.store.getSnapshot();
		let left = this.gutterWidth();
		let pinLeft = this.gutterWidth();
		return columns.map((column) => {
			const cs = state.columns.find((c) => c.id === column.id);
			const width = cs?.width ?? column.width ?? 160;
			const pinned =
				!!cs?.pinned &&
				pinLeft + width <= Math.max(220, this.snapshot.width - 120);
			const result = { column, width, left, pinned, pinLeft };
			left += width;
			if (pinned) pinLeft += width;
			return result;
		});
	}
	address() {
		const { state, viewRows, columns } = this.store.getSnapshot();
		const b = rangeBounds(
			state,
			viewRows,
			columns,
			this.store.getOptions().getRowId,
		);
		return b
			? `${columnAddress(b.c0)}${b.r0 + 1}${b.r0 === b.r1 && b.c0 === b.c1 ? "" : `:${columnAddress(b.c1)}${b.r1 + 1}`}`
			: "";
	}
}
