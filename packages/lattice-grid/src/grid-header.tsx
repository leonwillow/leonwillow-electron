// biome-ignore-all lint/a11y/useSemanticElements: Virtualized ARIA column headers use the existing sortable layout.
// biome-ignore-all lint/a11y/useFocusableInteractive: Header controls own keyboard focus; row/group containers are not additional tab stops.
/**
 * @file 隔离正文滚动更新的网格表头。
 * 创建时间：2026-11-08；修改时间：2026-11-08。
 * 版本作用：表头仅响应数据、列状态、筛选、尺寸与拖动反馈，不随虚拟行窗口重新渲染。
 * 被调用：DataGrid；调用：原共享 Sortable、Checkbox、Popover 和 ColumnMenu。
 * 预期结果：保留分组、冻结、调宽、菜单和键盘交互，减少滚动中的重复工作。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	Sortable,
	SortableItem,
	SortableItemHandle,
	type SortableRootProps,
} from "@leonwillow-electron/ui/components/sortable";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import { type CSSProperties, memo, useId } from "react";
import { ColumnMenu } from "./column-menu";
import { formatValue, numericFilter } from "./core/data";
import type { Column, GridSnapshot } from "./core/types";
import type { useColumnDrag } from "./use-column-drag";
import type { GridView } from "./view-controller";

const horizontalDrag: NonNullable<SortableRootProps<unknown>["modifiers"]> = [
	({ transform }) => ({ ...transform, y: 0 }),
];
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

function GridHeaderView<T>({
	view,
	snapshot: s,
	layout,
	drag,
	headHeight,
	headerHeight,
	groupHeaderHeight,
	filterHeight,
	groupStickyLeft,
	showFilters,
	visibleSelected,
	selectAllLabel,
	resizeLabel,
	locale,
}: {
	view: GridView<T>;
	snapshot: GridSnapshot<T>;
	layout: ReturnType<GridView<T>["layout"]>;
	drag: ReturnType<typeof useColumnDrag<T>>;
	headHeight: number;
	headerHeight: number;
	groupHeaderHeight: number;
	filterHeight: number;
	groupStickyLeft: number;
	showFilters: boolean;
	visibleSelected: number;
	selectAllLabel: string;
	resizeLabel: string;
	locale: string;
}) {
	const store = view.store;
	const grouped = s.columns.some((column) => column.group);
	const headerRows = grouped ? 2 : 1;
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
		<div className="lg-head" role="rowgroup" style={{ height: headHeight }}>
			{grouped && (
				<div
					role="row"
					aria-rowindex={1}
					className="lg-group-row"
					style={
						{
							height: groupHeaderHeight,
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
			<div role="row" aria-rowindex={headerRows} className="lg-column-row">
				<div role="columnheader" className="lg-gutter lg-corner">
					<Checkbox
						aria-label={selectAllLabel}
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
							autoScroll={false}
							onDragStart={drag.start}
							onDragEnd={drag.end}
							onDragCancel={drag.end}
							dropAnimation={drag.dropAnimation}
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
								const sort = s.state.sorting.find((item) => item.id === col.id);
								return (
									<SortableItem
										value={col.id}
										data-column-moved={drag.marker(col.id)}
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
												height: headHeight - groupHeaderHeight,
												"--lg-header-height": `${headerHeight}px`,
												"--lg-filter-height": `${filterHeight}px`,
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
											<ColumnMenu store={store} column={col} view={view} />
										</div>
										{showFilters && (
											<div className="lg-filter">
												{col.filterable !== false && (
													<ColumnFilter view={view} column={col} />
												)}
											</div>
										)}
										<div
											role="separator"
											tabIndex={0}
											aria-label={`${resizeLabel} ${col.header}`}
											aria-orientation="vertical"
											aria-valuenow={c.width}
											aria-valuemin={col.minWidth ?? 64}
											aria-valuemax={col.maxWidth ?? 800}
											className="lg-resizer"
											onPointerDown={(e) =>
												view.startResize(e.nativeEvent, col.id)
											}
											onKeyDown={(e) => {
												if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
													e.preventDefault();
													e.stopPropagation();
													store.setColumn(col.id, {
														width: c.width + (e.key === "ArrowLeft" ? -8 : 8),
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
																		formatValue(row, col, locale).length * 7.6 +
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
	);
}

export const GridHeader = memo(GridHeaderView) as typeof GridHeaderView;
