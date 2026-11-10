// biome-ignore-all lint/a11y/useSemanticElements: Virtualized ARIA grid rows are absolutely positioned; native table layout cannot represent the visible window and pinned cells.
// biome-ignore-all lint/a11y/useFocusableInteractive: The grid owns keyboard focus and exposes its active cell through aria-activedescendant; nested controls keep their own focus behavior.
/**
 * @file Lattice Grid 的 React / ReUI 可复用表格视图。
 * 创建时间：2026-11-05；修改时间：2026-11-08。
 * 版本作用：保留原引擎与选择、编辑、虚拟化控制器，使用当前共享控件与主题呈现。
 * 被调用：业务页面；调用：GridStore、GridView、共享 Base UI 控件与 Sonner。
 * 预期结果：稳定行 ID、受控数据和提交回调与业务解耦；可填满父级剩余高度，汇总始终位于滚动口底部。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { Separator } from "@leonwillow-electron/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Columns3Icon,
	DownloadIcon,
	FilterIcon,
	PinIcon,
	Redo2Icon,
	RotateCcwIcon,
	SearchIcon,
	Undo2Icon,
	XIcon,
} from "lucide-react";
import {
	type ComponentProps,
	type CSSProperties,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { CellContextMenu, type InsertRowsRequest } from "./cell-context-menu";
import { CellIndicator } from "./cell-indicator";
import { columnRenderPlan } from "./column-window";
import { rangeBounds } from "./core/data";
import { formatGridError, zhCN } from "./core/messages";
import { GridStore } from "./core/store";
import type { CellPosition, Column, GridOptions } from "./core/types";
import { DeleteRowsButton } from "./delete-rows-button";
import { GridHeader } from "./grid-header";
import { GridRow } from "./grid-row";
import { useColumnDrag } from "./use-column-drag";
import {
	type CellContext,
	type EditorContext,
	GridView,
	type ViewOptions,
} from "./view-controller";

export type DataGridProps<T> = GridOptions<T> &
	Omit<
		ViewOptions<T>,
		"id" | "renderCell" | "renderEditor" | "renderToolbar" | "renderEmpty"
	> & {
		id?: string;
		onInsertRows?: (request: InsertRowsRequest<T>) => void | Promise<void>;
		apiRef?: Ref<GridStore<T>>;
		/** 新请求对象出现时定位一次；等待宿主行数据就绪，不因后续保存抢回焦点。 */
		revealCell?: CellPosition | null;
		/** 填满有界纵向 flex 父级的剩余高度，启用时优先于固定 height。 */
		fillHeight?: boolean;
		/** 兼容已有的通用插槽，位于搜索框之后；新接入优先按用途提供 toolbarSlots。 */
		toolbarContent?: ReactNode;
		/** 按用途加入共享工具组；隐藏 toolbar 时一并隐藏，不改变按钮自身的事件与状态。 */
		toolbarSlots?: {
			filters?: ReactNode;
			actions?: ReactNode;
			actionsEnd?: ReactNode;
			exports?: ReactNode;
		};
		renderCell?: (context: CellContext<T>) => ReactNode;
		renderEditor?: (context: EditorContext<T>) => ReactNode;
		renderToolbar?: (store: GridStore<T>) => ReactNode;
		renderEmpty?: () => ReactNode;
	};

function IconButton({
	label,
	children,
	...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & { label: string }) {
	return (
		<Tooltip disableHoverablePopup>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						{...props}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
function GridPopover({
	label,
	trigger,
	children,
}: {
	label: string;
	trigger: ReactNode;
	children: ReactNode;
}) {
	return (
		<Popover>
			<PopoverTrigger
				render={<Button variant="ghost" size="icon-sm" aria-label={label} />}
			>
				{trigger}
			</PopoverTrigger>
			<PopoverContent
				aria-label={label}
				className="lg-control-popup"
				align="start"
				scrollable
				scrollContentClassName="flex flex-col gap-2 p-3"
			>
				<p className="font-medium">{label}</p>
				{children}
			</PopoverContent>
		</Popover>
	);
}
function ColumnSettings<T>({
	store,
	column,
}: {
	store: GridStore<T>;
	column: Column<T>;
}) {
	const checkboxId = useId();
	const s = store.getSnapshot();
	const state = s.state.columns.find((item) => item.id === column.id);
	if (!state) return null;
	return (
		<div className="lg-column-controls">
			<label className="lg-check-label" htmlFor={checkboxId}>
				<Checkbox
					id={checkboxId}
					checked={!state.hidden}
					onCheckedChange={(checked) =>
						store.setColumn(column.id, { hidden: !checked })
					}
				/>
				<span className="lg-check-text">{column.header}</span>
			</label>
			<IconButton
				label={state.pinned ? "取消冻结列" : "冻结列"}
				aria-pressed={state.pinned}
				onClick={() => store.setColumn(column.id, { pinned: !state.pinned })}
			>
				<PinIcon />
			</IconButton>
			<IconButton
				label="向左移动列"
				disabled={!store.canMoveColumn(column.id, -1)}
				onClick={() => store.moveColumn(column.id, -1)}
			>
				<ChevronLeftIcon />
			</IconButton>
			<IconButton
				label="向右移动列"
				disabled={!store.canMoveColumn(column.id, 1)}
				onClick={() => store.moveColumn(column.id, 1)}
			>
				<ChevronRightIcon />
			</IconButton>
		</div>
	);
}
/** 行数据由宿主提供；onCommit 可在本地提交前执行异步校验/保存，失败保留原值。 */
export function DataGrid<T>(props: DataGridProps<T>) {
	const generatedId = useId();
	const id =
		props.id ?? `lattice-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const options = { ...props, locale: props.locale ?? "zh-CN" };
	const formatError = useCallback(
		(message: string) =>
			props.formatError
				? props.formatError(message)
				: formatGridError(message, options.locale),
		[props.formatError, options.locale],
	);
	const [store] = useState(() => new GridStore<T>(options));
	const [view] = useState(
		() =>
			new GridView(store, {
				...props,
				id,
				messages: { ...zhCN, ...props.messages },
				formatError,
			}),
	);
	view.update({
		...props,
		id,
		messages: { ...zhCN, ...props.messages },
		formatError,
	});
	const s = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const v = useSyncExternalStore(
		view.subscribe,
		view.getPresentationSnapshot,
		view.getPresentationSnapshot,
	);
	useEffect(() => {
		store.updateOptions(options);
	});
	useEffect(() => view.mount(), [view]);
	useEffect(() => () => store.cancelPending(), [store]);
	useImperativeHandle(props.apiRef, () => store, [store]);
	const revealed = useRef<CellPosition | null>(null);
	useEffect(() => {
		const request = props.revealCell;
		if (!request || revealed.current === request) return;
		const rowIndex = s.viewRows.findIndex(
			(row) => store.getOptions().getRowId(row) === request.rowId,
		);
		const columnIndex = s.columns.findIndex((c) => c.id === request.columnId);
		if (rowIndex < 0 || columnIndex < 0) return;
		revealed.current = request;
		view.ensureVisible(rowIndex, columnIndex);
		view.select(request);
	}, [props.revealCell, s.viewRows, s.columns, store, view]);
	useEffect(() => {
		if (s.error && !props.onError)
			toast.error(formatError(s.error), {
				id: `${id}-error`,
			});
		else if (!s.error) toast.dismiss(`${id}-error`);
	}, [s.error, props.onError, formatError, id]);
	useEffect(
		() => () => {
			toast.dismiss(`${id}-error`);
		},
		[id],
	);
	const rootRef = useCallback(
		(el: HTMLDivElement | null) => {
			view.root = el;
		},
		[view],
	);
	const viewportRef = useCallback(
		(el: HTMLDivElement | null) => {
			view.scroller = el;
		},
		[view],
	);
	const drag = useColumnDrag(view);
	const m = view.messages();
	const layout = view.layout();
	const movedColumn = layout.find((c) => drag.marker(c.column.id))?.column.id;
	const moveMarker = movedColumn ? drag.marker(movedColumn) : undefined;
	const rh = view.rowHeight();
	const grouped = s.columns.some((c) => c.group);
	const headerRows = grouped ? 2 : 1;
	const total = view.gutterWidth() + layout.reduce((n, c) => n + c.width, 0);
	// 复用实际冻结布局；窄窗口解除冻结后，组名停靠点随之退回行号列后。
	const groupStickyLeft = layout.reduce(
		(left, column) => left + (column.pinned ? column.width : 0),
		view.gutterWidth(),
	);
	const frozenShadow =
		v.scrollX &&
		layout.some((column) => column.pinned) &&
		layout.some((column) => !column.pinned);
	const bounds = rangeBounds(s.state, s.viewRows, s.columns, props.getRowId);
	const selected = new Set(s.state.selectedRows);
	const visibleSelected = s.viewRows.filter((row) =>
		selected.has(props.getRowId(row)),
	).length;
	const active = s.state.selection?.focus;
	const retainOffscreen = (columnId?: string) => {
		const index = layout.findIndex((item) => item.column.id === columnId);
		return index >= 0 &&
			!layout[index]?.pinned &&
			(index < v.columnStart || index >= v.columnEnd)
			? columnId
			: undefined;
	};
	const retainedActiveColumn = retainOffscreen(active?.columnId);
	const retainedEditingColumn = retainOffscreen(v.editing?.columnId);
	const columnSlots = useMemo(
		() =>
			columnRenderPlan(
				layout,
				{ columnStart: v.columnStart, columnEnd: v.columnEnd },
				retainedActiveColumn,
				retainedEditingColumn,
			),
		[
			layout,
			v.columnStart,
			v.columnEnd,
			retainedActiveColumn,
			retainedEditingColumn,
		],
	);
	const activeIndex = active ? view.rowIndex(active.rowId) : -1;
	const cellId = (row: string, col: string) =>
		`${id}-cell-${encodeURIComponent(row)}-${encodeURIComponent(col)}`;
	const activeInView =
		activeIndex >= v.start &&
		activeIndex < v.end &&
		s.columns.some((c) => c.id === active?.columnId);
	const style = (c: (typeof layout)[number]): CSSProperties => ({
		width: c.width,
		minWidth: c.width,
		...(c.pinned ? { position: "sticky", left: c.pinLeft } : {}),
	});
	const busy = !!props.loading || !!props.error || s.pending;
	const nf = new Intl.NumberFormat(options.locale);
	const stats = view.stats();
	return (
		<CellContextMenu view={view} onInsertRows={props.onInsertRows}>
			{(contextTrigger) => (
				<div
					ref={rootRef}
					id={id}
					className={cn("lg-root", props.className)}
					style={
						{
							...props.style,
							"--lg-header-height": `${view.headerHeight()}px`,
							"--lg-filter-height": `${view.filterHeight()}px`,
							"--lg-frozen-edge": `${groupStickyLeft}px`,
						} as CSSProperties
					}
					data-density={s.state.density}
					data-fill-height={props.fillHeight || undefined}
				>
					{props.toolbar !== false && (
						<ScrollArea
							className="lg-toolbar-scroll"
							contentClassName="w-full"
							viewportProps={{ "aria-label": "表格工具栏" }}
						>
							<div className="lg-toolbar">
								<div className="lg-toolbar-filters">
									<InputGroup className="lg-search">
										<InputGroupInput
											type="search"
											aria-label={m.search}
											placeholder={m.search}
											value={s.state.search}
											onChange={(e) => {
												store.setState({ search: e.target.value }, "search");
												if (view.scroller) view.scroller.scrollTop = 0;
											}}
										/>
										<InputGroupAddon>
											<SearchIcon aria-hidden />
										</InputGroupAddon>
									</InputGroup>
									{props.toolbarContent != null && (
										<div className="lg-toolbar-content">
											{props.toolbarContent}
										</div>
									)}
									{props.toolbarSlots?.filters}
									<IconButton
										label={m.filter}
										aria-pressed={v.showFilters}
										onClick={() => {
											view.set({ showFilters: !v.showFilters });
											view.measure();
										}}
									>
										<FilterIcon />
									</IconButton>
								</div>
								<div className="lg-toolbar-tools">
									<div className="lg-toolbar-group">
										{props.toolbarSlots?.actions}
										{selected.size > 0 && (
											<div className="lg-bulk">
												<IconButton
													label={m.clearSelection}
													onClick={() =>
														store.setState({ selectedRows: [] }, "selectedRows")
													}
												>
													<XIcon />
												</IconButton>
												<span>
													{selected.size} {m.selected}
												</span>
												{props.allowDelete && (
													<DeleteRowsButton
														view={view}
														disabled={!!props.readOnly || busy}
													/>
												)}
											</div>
										)}
										<div className="lg-actions">
											{v.editing ? (
												<>
													<IconButton
														label={m.save}
														data-lg-edit-scope={id}
														disabled={busy}
														onClick={() => void view.commitEdit()}
													>
														<CheckIcon />
													</IconButton>
													<IconButton
														label={m.cancel}
														data-lg-edit-scope={id}
														disabled={s.pending}
														onClick={() => view.cancelEdit()}
													>
														<XIcon />
													</IconButton>
												</>
											) : (
												<>
													<IconButton
														label={m.undo}
														disabled={!s.canUndo || busy}
														onClick={() => void store.undo()}
													>
														<Undo2Icon />
													</IconButton>
													<IconButton
														label={m.redo}
														disabled={!s.canRedo || busy}
														onClick={() => void store.redo()}
													>
														<Redo2Icon />
													</IconButton>
												</>
											)}
										</div>
										{props.toolbarSlots?.actionsEnd}
									</div>
									{(props.toolbarSlots?.exports != null ||
										props.exportable !== false) && (
										<div className="lg-toolbar-group">
											<Separator
												orientation="vertical"
												className="lg-toolbar-separator"
											/>
											{props.toolbarSlots?.exports}
											{props.exportable !== false && (
												<IconButton
													label={m.export}
													disabled={!s.columns.length}
													onClick={() => view.export()}
												>
													<DownloadIcon />
												</IconButton>
											)}
										</div>
									)}
									<div className="lg-toolbar-group">
										<Separator
											orientation="vertical"
											className="lg-toolbar-separator"
										/>
										<GridPopover label={m.columns} trigger={<Columns3Icon />}>
											{props.columns.map((column) => (
												<ColumnSettings
													key={column.id}
													store={store}
													column={column}
												/>
											))}
											<Button variant="ghost" onClick={() => store.resetView()}>
												<RotateCcwIcon />
												{m.resetView}
											</Button>
										</GridPopover>
										<Select
											items={(
												["compact", "standard", "comfortable"] as const
											).map((value) => ({ value, label: m[value] }))}
											value={s.state.density}
											onValueChange={(value) => {
												if (value)
													store.setState({ density: value }, "density");
											}}
										>
											<SelectTrigger aria-label={m.density}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{(
														["compact", "standard", "comfortable"] as const
													).map((value) => (
														<SelectItem key={value} value={value}>
															{m[value]}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</div>
								</div>
								{props.renderToolbar?.(store)}
							</div>
						</ScrollArea>
					)}
					<p id={`${id}-help`} className="sr-only">
						{m.keyboardHelp}
					</p>
					<ScrollArea
						className="lg-scroll-area"
						data-frozen-shadow={frozenShadow || undefined}
						style={
							props.height && !props.fillHeight
								? { height: props.height }
								: undefined
						}
						contentClassName="grid min-h-full"
						viewportProps={{
							render: contextTrigger,
							ref: viewportRef,
							className: "lg-scroller",
							role: "grid",
							tabIndex: 0,
							"aria-label": props.label ?? "数据表格",
							"aria-describedby": `${id}-help`,
							"aria-rowcount":
								s.viewRows.length +
								headerRows +
								(props.summary === false ? 0 : 1),
							"aria-colcount": s.columns.length + 1,
							"aria-multiselectable": true,
							"aria-readonly": !!props.readOnly,
							"aria-busy": busy,
							"aria-activedescendant":
								active && activeInView
									? cellId(active.rowId, active.columnId)
									: undefined,
							onScroll: view.onScroll,
							onKeyDown: (e) => {
								if (
									e.shiftKey &&
									e.key === " " &&
									active &&
									e.target === e.currentTarget
								) {
									e.preventDefault();
									store.toggleRow(active.rowId);
								} else view.onKeyDown(e.nativeEvent);
							},
							onCopy: (e) => view.onCopy(e.nativeEvent),
							onPaste: (e) => view.onPaste(e.nativeEvent),
						}}
					>
						<div
							className="lg-sheet"
							style={{ width: total, minWidth: "100%" }}
						>
							<GridHeader
								view={view}
								snapshot={s}
								layout={layout}
								drag={drag}
								headHeight={view.headHeight()}
								groupHeaderHeight={view.groupHeaderHeight()}
								headerHeight={view.headerHeight()}
								filterHeight={view.filterHeight()}
								groupStickyLeft={groupStickyLeft}
								showFilters={v.showFilters}
								visibleSelected={visibleSelected}
								selectAllLabel={m.selectAll}
								resizeLabel={m.resize}
								locale={options.locale}
							/>
							<div
								className="lg-body"
								role="rowgroup"
								style={{
									height:
										props.loading ||
										props.error ||
										!s.columns.length ||
										!s.viewRows.length
											? rh * 4
											: s.viewRows.length * rh,
								}}
							>
								{!(props.loading || props.error) &&
									s.columns.length > 0 &&
									s.viewRows.slice(v.start, v.end).map((row, index) => {
										const r = index + v.start;
										const rowId = props.getRowId(row);
										const inRange =
											!!bounds && r >= bounds.r0 && r <= bounds.r1;
										const editing = v.editing?.rowId === rowId;
										return (
											<GridRow
												key={rowId}
												id={id}
												view={view}
												row={row}
												rowId={rowId}
												rowIndex={r}
												rowHeight={rh}
												headerRows={headerRows}
												last={r === s.viewRows.length - 1}
												checked={selected.has(rowId)}
												selectLabel={m.selectRow}
												layout={layout}
												columnSlots={columnSlots}
												selectionStart={inRange ? bounds.c0 : -1}
												selectionEnd={inRange ? bounds.c1 : -1}
												activeColumn={
													active?.rowId === rowId ? active.columnId : undefined
												}
												editingColumn={
													editing ? v.editing?.columnId : undefined
												}
												error={editing ? s.error : ""}
												disabled={
													!!(
														store.getOptions().readOnly ||
														store.getOptions().loading ||
														store.getOptions().error ||
														s.pending
													)
												}
												pending={editing && s.pending}
												movedColumn={movedColumn}
												moveMarker={moveMarker}
												locale={options.locale}
												renderCell={props.renderCell}
												renderEditor={props.renderEditor}
											/>
										);
									})}
								<CellIndicator view={view} />
								{(props.loading ||
									props.error ||
									!s.viewRows.length ||
									!s.columns.length) && (
									<div className="lg-empty" style={{ width: v.width }}>
										{props.loading ? (
											m.loading
										) : props.error ? (
											<>
												<span role="alert">{props.error}</span>
												{props.onRetry && (
													<Button variant="outline" onClick={props.onRetry}>
														{m.retry}
													</Button>
												)}
											</>
										) : !s.columns.length ? (
											<>
												<p>{m.allColumnsHidden}</p>
												<Button
													variant="outline"
													onClick={() =>
														store.setState(
															{
																columns: s.state.columns.map((c) => ({
																	...c,
																	hidden: false,
																})),
															},
															"columns",
														)
													}
												>
													{m.showAll}
												</Button>
											</>
										) : (
											(props.renderEmpty?.() ??
											(s.rows.length ? m.noResults : m.empty))
										)}
									</div>
								)}
							</div>
							{props.summary !== false && (
								<div
									role="row"
									aria-rowindex={s.viewRows.length + headerRows + 1}
									className="lg-summary"
									aria-label="汇总"
								>
									<div role="gridcell" className="lg-gutter" />
									{layout.map((c, i) => {
										const value = c.column.aggregate
											? view.total(c.column)
											: null;
										const label =
											c.column.aggregateLabel ??
											(c.column.aggregate === "avg"
												? m.avg
												: c.column.aggregate === "count"
													? m.count
													: m.sum);
										return (
											<div
												key={c.column.id}
												role="gridcell"
												className={cn(
													"lg-summary-cell",
													c.pinned && "lg-pinned",
												)}
												style={style(c)}
											>
												{value != null ? (
													<>
														{label && <span>{label}</span>}
														<strong>
															{c.column.formatAggregate
																? c.column.formatAggregate(
																		value,
																		options.locale,
																	)
																: typeof value === "number"
																	? nf.format(value)
																	: String(value)}
														</strong>
													</>
												) : i === 0 ? (
													`${s.viewRows.length} ${m.rows}`
												) : null}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</ScrollArea>
					{props.statusBar !== false && (
						<div className="lg-status">
							<strong>{view.address()}</strong>
							{stats.count > 0 && (
								<span>
									{m.count} {nf.format(stats.count)}
								</span>
							)}
							{stats.numericCount > 0 && (
								<span>
									{m.sum} {nf.format(stats.sum)} · {m.avg}{" "}
									{nf.format(stats.sum / stats.numericCount)}
								</span>
							)}
							<span className="lg-status-message" role="status">
								{s.pending
									? m.saving
									: v.notice || (props.readOnly ? m.readOnly : "")}
							</span>
						</div>
					)}
				</div>
			)}
		</CellContextMenu>
	);
}
