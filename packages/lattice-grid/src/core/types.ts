/**
 * @file Lattice Grid types：泛型表格数据与事务内核。
 * 创建时间：2026-11-05；修改时间：2026-11-08。
 * 版本作用：适配 MIT Lattice Grid 0.1.0-beta.1，保留原始行标识、不可变事务与数据隔离。
 * 被调用：独立表格包的 React 视图；调用：包内核心模块，不依赖业务、数据库或路由。
 * 预期结果：多个表格实例独立工作，外部数据和提交由调用页面管理。
 */
export type RowId = string;
export type CellValue = string | number | boolean | null | undefined;
export type Density = "compact" | "standard" | "comfortable";
export interface CellPosition {
	rowId: RowId;
	columnId: string;
}
export interface CellRange {
	anchor: CellPosition;
	focus: CellPosition;
}
export interface Sort {
	id: string;
	direction: "asc" | "desc";
}
export type Filter = string | readonly string[];
export interface ColumnState {
	id: string;
	width: number;
	hidden: boolean;
	pinned: boolean;
}
export interface GridState {
	search: string;
	filters: Record<string, Filter>;
	sorting: readonly Sort[];
	columns: readonly ColumnState[];
	density: Density;
	selection: CellRange | null;
	selectedRows: readonly RowId[];
}
export interface Column<T> {
	id: string;
	header: string;
	/** 相邻同组列显示共享表头，空值保持单层。 */
	group?: string;
	field?: keyof T;
	getValue?: (row: T) => CellValue;
	/** Return a new row. Do not mutate the argument. */
	setValue?: (row: T, value: CellValue) => T;
	type?: "text" | "number" | "date" | "select" | "boolean";
	/** 显示与编辑共用的对齐；数字列默认 end，其他列默认 start。 */
	align?: "start" | "center" | "end";
	/** 仅控制编辑键盘，不改变 parse 的数据类型或精度。 */
	inputMode?:
		| "none"
		| "text"
		| "decimal"
		| "numeric"
		| "tel"
		| "search"
		| "email"
		| "url";
	width?: number;
	minWidth?: number;
	maxWidth?: number;
	hidden?: boolean;
	pinned?: boolean;
	editable?: boolean | ((row: T) => boolean);
	/** 选择器类列可单击进入编辑；默认仍为双击，Shift 选区和拖选不触发。 */
	editOnClick?: boolean;
	sortable?: boolean;
	filterable?: boolean;
	options?: readonly string[];
	required?: boolean;
	min?: number;
	max?: number;
	integer?: boolean;
	parse?: (input: string, row: T) => CellValue;
	format?: (value: CellValue, row: T, locale: string) => string;
	/** 返回可由 parse 接受的编辑文本；仅打开并离开不会写回此格式化值。 */
	formatEdit?: (value: CellValue, row: T) => string;
	validate?: (
		value: CellValue,
		row: T,
	) => string | undefined | Promise<string | undefined>;
	compare?: (a: CellValue, b: CellValue, rowA: T, rowB: T) => number;
	filter?: (value: CellValue, filter: Filter, row: T) => boolean;
	/** 覆盖汇总单元格的前缀标签；空字符串仅显示结果，省略时沿用合计/平均/计数。 */
	aggregateLabel?: string;
	formatAggregate?: (value: CellValue, locale: string) => string;
	aggregate?: "sum" | "avg" | "count" | ((rows: readonly T[]) => CellValue);
}
export interface Patch {
	rowId: RowId;
	columnId: string;
	value: CellValue;
}
export interface Transaction<T> {
	source:
		| "edit"
		| "paste"
		| "clear"
		| "insert"
		| "delete"
		| "undo"
		| "redo"
		| "api";
	patches: readonly Patch[];
	previousRows: readonly T[];
	rows: readonly T[];
	deletedIds: readonly RowId[];
}
export interface CommitResult {
	ok: boolean;
	error?: string;
}
export interface GridOptions<T> {
	rows: readonly T[];
	columns: readonly Column<T>[];
	getRowId: (row: T) => RowId;
	initialState?: Partial<GridState>;
	/** Passing state makes view state fully controlled. Update it in onStateChange. */
	state?: GridState;
	onStateChange?: (state: GridState, reason: string) => void;
	onRowsChange?: (rows: readonly T[], transaction: Transaction<T>) => void;
	/** Pessimistic transaction: reject to keep all original cells. Persist atomically on your server. */
	onCommit?: (
		transaction: Transaction<T>,
		context: { signal: AbortSignal },
	) => void | Promise<void>;
	onError?: (error: Error) => void;
	readOnly?: boolean;
	allowDelete?: boolean;
	historyLimit?: number;
	/**
	 * "editable" allows a controlled parent to echo accepted cells with fresh derived fields.
	 * History is retained only when ordered row IDs and editable values match exactly.
	 * Undo/redo replay cell patches on current rows instead of restoring derived snapshots.
	 * Omit to reset history for any external rows replacement, as in the original engine.
	 */
	reconcileRows?: "editable";
	locale?: string;
	mode?: "client" | "server";
	/** Server mode receives only the loaded page. Sorting/filtering are delegated to the host. */
	totalRows?: number;
	loading?: boolean;
	error?: string;
	onRetry?: () => void;
}
export interface GridSnapshot<T> {
	rows: readonly T[];
	viewRows: readonly T[];
	columns: readonly Column<T>[];
	state: GridState;
	pending: boolean;
	error: string;
	canUndo: boolean;
	canRedo: boolean;
	/** Changes only when external source rows or schema replace the accepted data. */
	externalRevision: number;
	revision: number;
}
export type Messages = {
	search: string;
	rows: string;
	filter: string;
	columns: string;
	export: string;
	undo: string;
	redo: string;
	density: string;
	compact: string;
	standard: string;
	comfortable: string;
	empty: string;
	noResults: string;
	loading: string;
	retry: string;
	count: string;
	sum: string;
	avg: string;
	selectAll: string;
	selectRow: string;
	selected: string;
	delete: string;
	clearSelection: string;
	pin: string;
	unpin: string;
	hide: string;
	sortAscending: string;
	sortDescending: string;
	clearSort: string;
	moveLeft: string;
	moveRight: string;
	allColumnsHidden: string;
	showAll: string;
	resetView: string;
	save: string;
	cancel: string;
	saving: string;
	copied: string;
	copy: string;
	resize: string;
	close: string;
	all: string;
	readOnly: string;
	loaded: string;
	keyboardHelp: string;
	clipboardUnavailable: string;
};
