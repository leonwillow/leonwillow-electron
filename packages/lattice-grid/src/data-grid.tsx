// biome-ignore-all lint/a11y/useSemanticElements: Virtualized ARIA grid rows are absolutely positioned; native table layout cannot represent the visible window and pinned cells.
// biome-ignore-all lint/a11y/useFocusableInteractive: The grid owns keyboard focus and exposes its active cell through aria-activedescendant; nested controls keep their own focus behavior.
/**
 * @file Lattice Grid 的 React / ReUI 可复用表格视图。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：保留原引擎与选择、编辑、虚拟化控制器，使用当前共享控件与主题呈现。
 * 被调用：业务页面；调用：GridStore、GridView、共享 Base UI 控件与 Sonner。
 * 预期结果：稳定行 ID、受控数据和提交回调与业务解耦，滚动节点供控制器准确测量。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { Input } from "@leonwillow-electron/ui/components/input";
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
import {
	Sortable,
	SortableItem,
	SortableItemHandle,
	type SortableRootProps,
} from "@leonwillow-electron/ui/components/sortable";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Columns3Icon,
	CopyIcon,
	DownloadIcon,
	FilterIcon,
	GripVerticalIcon,
	PinIcon,
	Redo2Icon,
	RotateCcwIcon,
	SearchIcon,
	Trash2Icon,
	Undo2Icon,
	XIcon,
} from "lucide-react";
import {
	type ComponentProps,
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useState,
	useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { CellIndicator } from "./cell-indicator";
import { ColumnMenu } from "./column-menu";

const horizontalDrag: NonNullable<SortableRootProps<unknown>["modifiers"]> = [
	({ transform }) => ({ ...transform, y: 0 }),
];

import {
	formatValue,
	getCellValue,
	numericFilter,
	rangeBounds,
} from "./core/data";
import { formatGridError, zhCN } from "./core/messages";
import { GridStore } from "./core/store";
import type { Column, GridOptions } from "./core/types";
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
		apiRef?: Ref<GridStore<T>>;
		/** 宿主筛选/操作插槽，位于行数之后、内置工具之前；隐藏 toolbar 时一并隐藏。 */
		toolbarContent?: ReactNode;
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
function ColumnFilter<T>({
	view,
	column,
}: {
	view: GridView<T>;
	column: Column<T>;
}) {
	const filterId = useId();
	const store = view.store;
	const s = store.getSnapshot();
	const filter = s.state.filters[column.id];
	if (column.options) {
		const chosen = new Set(Array.isArray(filter) ? filter : column.options);
		return (
			<Popover>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							className="w-full"
							aria-label={`筛选 ${column.header}`}
						/>
					}
				>
					{Array.isArray(filter) ? `${filter.length} 项已选择` : "全部"}
				</PopoverTrigger>
				<PopoverContent
					align="start"
					aria-label={`筛选 ${column.header}`}
					scrollable
				>
					<label className="lg-check-label" htmlFor={`${filterId}-all`}>
						<Checkbox
							id={`${filterId}-all`}
							checked={chosen.size === column.options.length}
							onCheckedChange={(checked) => {
								const filters = { ...s.state.filters };
								if (checked) delete filters[column.id];
								else filters[column.id] = [];
								store.setState({ filters }, "filters");
							}}
						/>
						全部
					</label>
					{column.options.map((option, index) => (
						<label
							key={option}
							className="lg-check-label"
							htmlFor={`${filterId}-${index}`}
						>
							<Checkbox
								id={`${filterId}-${index}`}
								checked={chosen.has(option)}
								onCheckedChange={(checked) => {
									const next = new Set(chosen);
									if (checked) next.add(option);
									else next.delete(option);
									store.setState(
										{ filters: { ...s.state.filters, [column.id]: [...next] } },
										"filters",
									);
								}}
							/>
							{option}
						</label>
					))}
				</PopoverContent>
			</Popover>
		);
	}
	return (
		<Input
			aria-label={`筛选 ${column.header}`}
			placeholder={column.type === "number" ? ">= 100" : "筛选"}
			value={typeof filter === "string" ? filter : ""}
			aria-invalid={
				column.type === "number" &&
				typeof filter === "string" &&
				numericFilter(filter) === null
			}
			onChange={(e) =>
				store.setState(
					{ filters: { ...s.state.filters, [column.id]: e.target.value } },
					"filters",
				)
			}
		/>
	);
}
function DefaultEditor<T>({
	view,
	column,
}: {
	view: GridView<T>;
	column: Column<T>;
}) {
	const v = view.getSnapshot();
	const s = view.store.getSnapshot();
	const [selectOpen, setSelectOpen] = useState(false);
	const onKeyDown = async (e: KeyboardEvent) => {
		if (e.nativeEvent.isComposing) return;
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			view.cancelEdit();
		} else if (e.key === "Enter" || e.key === "Tab") {
			e.preventDefault();
			e.stopPropagation();
			if (await view.commitEdit())
				view.move(
					e.key === "Enter" ? (e.shiftKey ? -1 : 1) : 0,
					e.key === "Tab" ? (e.shiftKey ? -1 : 1) : 0,
				);
		}
	};
	if (column.options || column.type === "boolean") {
		const items = [
			...(!column.required ? [{ label: "未填写", value: "" }] : []),
			...(column.options ?? ["true", "false"]).map((value) => ({
				label:
					column.type === "boolean" ? (value === "true" ? "是" : "否") : value,
				value,
			})),
		];
		return (
			<Select
				items={items}
				value={v.draft}
				open={selectOpen}
				onOpenChange={setSelectOpen}
				disabled={s.pending}
				onValueChange={(value) => {
					if (value !== null) view.set({ draft: value });
				}}
			>
				<SelectTrigger
					data-lg-editor
					variant="cell"
					aria-label={column.header}
					className="w-full"
					onKeyDown={(event) => {
						if (!selectOpen && (event.key === "Tab" || event.key === "Escape"))
							void onKeyDown(event);
					}}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent
					data-lg-edit-scope={view.options.id}
					finalFocus={() => !!view.getSnapshot().editing}
				>
					<SelectGroup>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		);
	}
	return (
		<Input
			data-lg-editor
			variant="cell"
			aria-label={column.header}
			aria-invalid={!!s.error}
			value={v.draft}
			type={column.type === "date" ? "date" : "text"}
			inputMode={
				column.inputMode ?? (column.type === "number" ? "decimal" : undefined)
			}
			disabled={s.pending}
			onChange={(e) => view.set({ draft: e.target.value })}
			onKeyDown={onKeyDown}
		/>
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
		view.getSnapshot,
		view.getSnapshot,
	);
	useEffect(() => {
		store.updateOptions(options);
	});
	useEffect(() => view.mount(), [view]);
	useEffect(() => () => store.cancelPending(), [store]);
	useImperativeHandle(props.apiRef, () => store, [store]);
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
	const m = view.messages();
	const layout = view.layout();
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
	const canFill = view.canFillSelection();
	const selected = new Set(s.state.selectedRows);
	const visibleSelected = s.viewRows.filter((row) =>
		selected.has(props.getRowId(row)),
	).length;
	const active = s.state.selection?.focus;
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
	const groups: {
		label: string;
		width: number;
		key: string;
		count: number;
		pinned: boolean;
		left: number;
	}[] = [];
	for (const c of layout) {
		const previous = groups.at(-1);
		if (
			previous &&
			previous.label === (c.column.group ?? "") &&
			previous.pinned === c.pinned
		) {
			previous.width += c.width;
			previous.count++;
		} else
			groups.push({
				label: c.column.group ?? "",
				width: c.width,
				key: c.column.id,
				count: 1,
				pinned: c.pinned,
				left: c.pinLeft,
			});
	}
	return (
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
		>
			{props.toolbar !== false && (
				<div className="lg-toolbar">
					{selected.size ? (
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
								<IconButton
									label={m.delete}
									variant="destructive"
									disabled={props.readOnly || busy}
									onClick={() => void store.deleteRows()}
								>
									<Trash2Icon />
								</IconButton>
							)}
						</div>
					) : (
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
					)}
					<span className="lg-count">
						{nf.format(
							props.mode === "server"
								? (props.totalRows ?? s.rows.length)
								: s.viewRows.length,
						)}{" "}
						{m.rows}
						{props.mode === "server" ? ` · ${s.rows.length} ${m.loaded}` : ""}
					</span>
					{props.toolbarContent != null && (
						<div className="lg-toolbar-content">{props.toolbarContent}</div>
					)}
					<div className="lg-actions">
						<IconButton
							label={m.copy}
							disabled={!bounds}
							onClick={() => void view.copy()}
						>
							<CopyIcon />
						</IconButton>
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
						<GridPopover label={m.columns} trigger={<Columns3Icon />}>
							{props.columns.map((column) => (
								<ColumnSettings key={column.id} store={store} column={column} />
							))}
							<Button variant="ghost" onClick={() => store.resetView()}>
								<RotateCcwIcon />
								{m.resetView}
							</Button>
						</GridPopover>
						<Select
							items={(["compact", "standard", "comfortable"] as const).map(
								(value) => ({ value, label: m[value] }),
							)}
							value={s.state.density}
							onValueChange={(value) => {
								if (value) store.setState({ density: value }, "density");
							}}
						>
							<SelectTrigger aria-label={m.density}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{(["compact", "standard", "comfortable"] as const).map(
										(value) => (
											<SelectItem key={value} value={value}>
												{m[value]}
											</SelectItem>
										),
									)}
								</SelectGroup>
							</SelectContent>
						</Select>
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
					{props.renderToolbar?.(store)}
				</div>
			)}
			<p id={`${id}-help`} className="sr-only">
				{m.keyboardHelp}
			</p>
			<ScrollArea
				className="lg-scroll-area"
				data-frozen-shadow={frozenShadow || undefined}
				style={props.height ? { height: props.height } : undefined}
				contentClassName="min-h-full"
				viewportProps={{
					ref: viewportRef,
					className: "lg-scroller",
					role: "grid",
					tabIndex: 0,
					"aria-label": props.label ?? "数据表格",
					"aria-describedby": `${id}-help`,
					"aria-rowcount":
						s.viewRows.length + headerRows + (props.summary === false ? 0 : 1),
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
				<div className="lg-sheet" style={{ width: total, minWidth: "100%" }}>
					<div
						className="lg-head"
						role="rowgroup"
						style={{ height: view.headHeight() }}
					>
						{grouped && (
							<div
								role="row"
								aria-rowindex={1}
								className="lg-group-row"
								style={
									{
										height: view.groupHeaderHeight(),
										"--lg-group-sticky-left": `${groupStickyLeft}px`,
									} as CSSProperties
								}
							>
								<div role="columnheader" className="lg-gutter" />
								{groups.map((group) => (
									<div
										key={group.key}
										role="columnheader"
										aria-colspan={group.count}
										className="lg-group-heading"
										data-pinned={group.pinned || undefined}
										style={{
											width: group.width,
											minWidth: group.width,
											...(group.pinned
												? { position: "sticky", left: group.left }
												: {}),
										}}
									>
										<span className="lg-group-label">{group.label}</span>
									</div>
								))}
							</div>
						)}
						<div
							role="row"
							aria-rowindex={headerRows}
							className="lg-column-row"
						>
							<div role="columnheader" className="lg-gutter lg-corner">
								<Checkbox
									aria-label={m.selectAll}
									checked={
										!!s.viewRows.length && visibleSelected === s.viewRows.length
									}
									indeterminate={
										visibleSelected > 0 && visibleSelected < s.viewRows.length
									}
									disabled={!s.viewRows.length}
									onCheckedChange={() => store.toggleAll()}
								/>
							</div>
							{[true, false].map((pinned) => {
								const columns = layout.filter(
									(c) =>
										!!s.state.columns.find((item) => item.id === c.column.id)
											?.pinned === pinned,
								);
								return (
									<Sortable
										key={String(pinned)}
										className="lg-column-sortable"
										strategy="horizontal"
										modifiers={horizontalDrag}
										value={columns}
										getItemValue={(c) => c.column.id}
										onValueChange={(next) =>
											store.reorderVisibleColumns(
												next.map((c) => c.column.id),
												pinned,
											)
										}
										accessibility={{
											screenReaderInstructions: {
												draggable:
													"按空格键开始调整列顺序，左右方向键移动，再按空格键确认，Escape 取消。只能在同一固定区域内移动。",
											},
										}}
									>
										{columns.map((c) => {
											const col = c.column;
											const sort = s.state.sorting.find(
												(item) => item.id === col.id,
											);
											return (
												<SortableItem
													value={col.id}
													tabIndex={-1}
													data-last-column={
														col.id === layout.at(-1)?.column.id || undefined
													}
													key={col.id}
													role="columnheader"
													aria-colindex={s.columns.indexOf(col) + 2}
													aria-sort={
														sort
															? sort.direction === "asc"
																? "ascending"
																: "descending"
															: "none"
													}
													className={cn("lg-header", c.pinned && "lg-pinned")}
													style={
														{
															width: c.width,
															minWidth: c.width,
															height:
																view.headHeight() - view.groupHeaderHeight(),
															"--lg-header-height": `${view.headerHeight()}px`,
															"--lg-filter-height": `${view.filterHeight()}px`,
															"--lg-pin-left": `${c.pinLeft}px`,
														} as CSSProperties
													}
												>
													<div className="lg-heading">
														<SortableItemHandle
															render={
																<button
																	type="button"
																	aria-label={`拖动排列 ${col.header}`}
																/>
															}
															className="lg-drag-handle"
														>
															<GripVerticalIcon className="lg-header-icon" />
														</SortableItemHandle>
														<button
															type="button"
															className="lg-sort"
															disabled={col.sortable === false}
															onClick={(e) => store.sort(col.id, e.shiftKey)}
														>
															{col.header}
															{sort &&
																(sort.direction === "asc" ? (
																	<ArrowUpIcon className="lg-header-icon" />
																) : (
																	<ArrowDownIcon className="lg-header-icon" />
																))}
														</button>
														<ColumnMenu
															store={store}
															column={col}
															view={view}
														/>
													</div>
													{v.showFilters && (
														<div className="lg-filter">
															{col.filterable !== false && (
																<ColumnFilter view={view} column={col} />
															)}
														</div>
													)}
													<div
														role="separator"
														tabIndex={0}
														aria-label={`${m.resize} ${col.header}`}
														aria-orientation="vertical"
														aria-valuenow={c.width}
														aria-valuemin={col.minWidth ?? 64}
														aria-valuemax={col.maxWidth ?? 800}
														className="lg-resizer"
														onPointerDown={(e) =>
															view.startResize(e.nativeEvent, col.id)
														}
														onKeyDown={(e) => {
															if (
																e.key === "ArrowLeft" ||
																e.key === "ArrowRight"
															) {
																e.preventDefault();
																e.stopPropagation();
																store.setColumn(col.id, {
																	width:
																		c.width + (e.key === "ArrowLeft" ? -8 : 8),
																});
															}
														}}
														onDoubleClick={() =>
															store.setColumn(col.id, {
																width: Math.min(
																	480,
																	Math.max(
																		col.header.length * 8 + 56,
																		...s.viewRows
																			.slice(0, 300)
																			.map(
																				(row) =>
																					formatValue(row, col, options.locale)
																						.length *
																						7.6 +
																					26,
																			),
																	),
																),
															})
														}
													/>
												</SortableItem>
											);
										})}
									</Sortable>
								);
							})}
						</div>
					</div>
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
								return (
									<div
										key={rowId}
										role="row"
										aria-rowindex={r + headerRows + 1}
										aria-selected={selected.has(rowId)}
										className="lg-row"
										data-last-row={r === s.viewRows.length - 1 || undefined}
										style={{ top: r * rh, height: rh }}
										data-checked={selected.has(rowId) || undefined}
									>
										<div
											role="rowheader"
											aria-colindex={1}
											className="lg-gutter"
										>
											<span className="lg-row-number">{r + 1}</span>
											<Checkbox
												className="lg-row-check"
												tabIndex={-1}
												aria-label={`${m.selectRow} ${r + 1}`}
												checked={selected.has(rowId)}
												onCheckedChange={() => store.toggleRow(rowId)}
											/>
										</div>
										{layout.map((c, ci) => {
											const col = c.column;
											const editable = store.isEditable(row, col);
											const isSelected =
												!!bounds &&
												r >= bounds.r0 &&
												r <= bounds.r1 &&
												ci >= bounds.c0 &&
												ci <= bounds.c1;
											const isActive =
												active?.rowId === rowId && active.columnId === col.id;
											const editing =
												v.editing?.rowId === rowId &&
												v.editing.columnId === col.id;
											const context: CellContext<T> = {
												row,
												column: col,
												value: getCellValue(row, col),
												rowIndex: r,
												selected: isSelected,
											};
											const editorContext: EditorContext<T> = {
												...context,
												initialValue: v.draft,
												onValueChange: (value) => view.set({ draft: value }),
												editScope: id,
												commit: (value) => view.commitEdit(value),
												cancel: () => view.cancelEdit(),
											};
											return (
												<div
													key={col.id}
													id={cellId(rowId, col.id)}
													role="gridcell"
													aria-colindex={ci + 2}
													aria-selected={isSelected}
													aria-readonly={!editable}
													className={cn(
														"lg-cell",
														c.pinned && "lg-pinned",
														editable && isSelected && "lg-selected",
														editable && isActive && "lg-active",
														editing && "lg-editing",
													)}
													data-lg-cell
													data-row={r}
													data-col={col.id}
													data-align={
														col.align ??
														(col.type === "number" ? "end" : "start")
													}
													data-filling={
														editable &&
														v.fillRow != null &&
														bounds &&
														r > bounds.r1 &&
														r <= v.fillRow &&
														ci >= bounds.c0 &&
														ci <= bounds.c1
															? true
															: undefined
													}
													style={style(c)}
													onPointerDown={(e) =>
														view.startSelection(e.nativeEvent, {
															rowId,
															columnId: col.id,
														})
													}
													onDoubleClick={(event) => {
														if (
															!(event.target as HTMLElement).closest(
																"button,input,select,a,[data-lg-interactive]",
															)
														)
															view.startEdit({ rowId, columnId: col.id });
													}}
												>
													{editing ? (
														(props.renderEditor?.(editorContext) ?? (
															<DefaultEditor view={view} column={col} />
														))
													) : (
														<div className="lg-cell-value">
															{props.renderCell?.(context) ??
																formatValue(row, col, options.locale)}
														</div>
													)}
													{!editing &&
														canFill &&
														bounds &&
														r === bounds.r1 &&
														ci === bounds.c1 && (
															<span
																aria-hidden
																className="lg-fill-handle"
																onPointerDown={(e) => {
																	e.stopPropagation();
																	view.startFill(e.nativeEvent);
																}}
															/>
														)}
												</div>
											);
										})}
									</div>
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
								const value = c.column.aggregate ? view.total(c.column) : null;
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
										className={cn("lg-summary-cell", c.pinned && "lg-pinned")}
										style={style(c)}
									>
										{value != null ? (
											<>
												{label && <span>{label}</span>}
												<strong>
													{c.column.formatAggregate
														? c.column.formatAggregate(value, options.locale)
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
	);
}
