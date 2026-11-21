// biome-ignore-all lint/a11y/useSemanticElements: The virtualized ARIA grid positions cells independently of native table layout.
// biome-ignore-all lint/a11y/useFocusableInteractive: Keyboard focus remains on the grid via aria-activedescendant.
/**
 * @file 按单元格隔离显示内容与编辑草稿的 React 渲染。
 * 创建时间：2026-11-07；修改时间：2026-11-21。
 * 版本作用：浅比较显示依赖，区分选中与活动起点；选区和编辑框保留原几何。
 * 被调用：GridRow；调用：GridView、共享 Input/Select 和列格式化函数。
 * 预期结果：沿用原 DOM、事件和编辑生命周期，渲染函数变化仍及时生效。
 */
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	type KeyboardEvent,
	memo,
	type ReactNode,
	useState,
	useSyncExternalStore,
} from "react";
import { formatValue, getCellValue } from "./core/data";
import type { Column } from "./core/types";
import { SelectionEdge } from "./selection-outline";
import type { CellContext, EditorContext, GridView } from "./view-controller";

const CONCAVE_CORNERS = [
	["top-left", SelectionEdge.concaveTopLeft],
	["top-right", SelectionEdge.concaveTopRight],
	["bottom-right", SelectionEdge.concaveBottomRight],
	["bottom-left", SelectionEdge.concaveBottomLeft],
] as const;
const OUTLINE_EDGES = [
	["top", SelectionEdge.top],
	["right", SelectionEdge.right],
	["bottom", SelectionEdge.bottom],
	["left", SelectionEdge.left],
] as const;

function DefaultEditor<T>({
	view,
	column,
	draft,
	error,
	pending,
}: {
	view: GridView<T>;
	column: Column<T>;
	draft: string;
	error: string;
	pending: boolean;
}) {
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
				value={draft}
				open={selectOpen}
				onOpenChange={setSelectOpen}
				disabled={pending}
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
			aria-invalid={!!error}
			value={draft}
			type={column.type === "date" ? "date" : "text"}
			inputMode={
				column.inputMode ?? (column.type === "number" ? "decimal" : undefined)
			}
			disabled={pending}
			onChange={(e) => view.set({ draft: e.target.value })}
			onKeyDown={onKeyDown}
		/>
	);
}

function CellEditor<T>({
	id,
	view,
	context,
	error,
	pending,
	renderEditor,
}: {
	id: string;
	view: GridView<T>;
	context: CellContext<T>;
	error: string;
	pending: boolean;
	renderEditor?: (context: EditorContext<T>) => ReactNode;
}) {
	const draft = useSyncExternalStore(
		view.subscribe,
		view.getDraft,
		view.getDraft,
	);
	const editorContext: EditorContext<T> = {
		...context,
		initialValue: draft,
		onValueChange: (value) => view.set({ draft: value }),
		editScope: id,
		commit: (value) => view.commitEdit(value),
		cancel: (restoreFocus) => view.cancelEdit(restoreFocus),
	};
	return (
		renderEditor?.(editorContext) ?? (
			<DefaultEditor
				view={view}
				column={context.column}
				draft={draft}
				error={error}
				pending={pending}
			/>
		)
	);
}

function GridCellView<T>({
	id,
	view,
	row,
	rowId,
	rowIndex,
	column,
	columnIndex,
	width,
	pinLeft,
	unpinnedStart,
	selectionMask,
	rangeSelection,
	active,
	editable,
	editing,
	error,
	pending,
	locale,
	renderCell,
	renderEditor,
}: {
	id: string;
	view: GridView<T>;
	row: T;
	rowId: string;
	rowIndex: number;
	column: Column<T>;
	columnIndex: number;
	width: number;
	pinLeft?: number;
	unpinnedStart?: boolean;
	selectionMask: number;
	rangeSelection: boolean;
	active: boolean;
	editable: boolean;
	editing: boolean;
	error: string;
	pending: boolean;
	locale: string;
	renderCell?: (context: CellContext<T>) => ReactNode;
	renderEditor?: (context: EditorContext<T>) => ReactNode;
}) {
	const selected = (selectionMask & SelectionEdge.selected) !== 0;
	const outlineEdges =
		selectionMask & ~(SelectionEdge.selected | SelectionEdge.anchor);
	const context: CellContext<T> = {
		row,
		column,
		value: getCellValue(row, column),
		rowIndex,
		selected,
	};

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 网格根节点统一处理 Enter/F2 编辑，单元格通过 aria-activedescendant 接受键盘导航。
		<div
			id={`${id}-cell-${encodeURIComponent(rowId)}-${encodeURIComponent(column.id)}`}
			role="gridcell"
			aria-colindex={columnIndex + 2}
			aria-selected={selected}
			aria-readonly={!editable}
			className={cn(
				"lg-cell",
				pinLeft !== undefined && "lg-pinned",
				selected && "lg-selected",
				active && "lg-active",
				editing && "lg-editing",
			)}
			data-lg-cell
			data-selection-anchor={
				!!(selectionMask & SelectionEdge.anchor) || undefined
			}
			data-row={rowIndex}
			data-col={column.id}
			data-unpinned-start={unpinnedStart || undefined}
			data-align={column.align ?? (column.type === "number" ? "end" : "start")}
			style={{
				width,
				minWidth: width,
				...(pinLeft !== undefined ? { position: "sticky", left: pinLeft } : {}),
			}}
			onPointerDown={(event) =>
				view.startSelection(event.nativeEvent, { rowId, columnId: column.id })
			}
			onClick={(event) => {
				if (
					!column.editOnClick ||
					editing ||
					event.shiftKey ||
					event.metaKey ||
					event.ctrlKey ||
					event.altKey
				)
					return;
				if (
					(event.target as HTMLElement).closest(
						"button,input,select,a,[data-lg-interactive]",
					)
				)
					return;
				const selection = view.store.getSnapshot().state.selection;
				if (
					selection?.anchor.rowId === rowId &&
					selection.anchor.columnId === column.id &&
					selection.focus.rowId === rowId &&
					selection.focus.columnId === column.id
				)
					view.startEdit({ rowId, columnId: column.id });
			}}
			onDoubleClick={(event) => {
				if (
					!(event.target as HTMLElement).closest(
						"button,input,select,a,[data-lg-interactive]",
					)
				)
					view.startEdit({ rowId, columnId: column.id });
			}}
		>
			{editing ? (
				<CellEditor
					id={id}
					view={view}
					context={context}
					renderEditor={renderEditor}
					error={error}
					pending={pending}
				/>
			) : (
				<div className="lg-cell-value">
					{renderCell?.(context) ?? formatValue(row, column, locale)}
				</div>
			)}
			{rangeSelection && outlineEdges !== 0 && !editing && (
				<span
					aria-hidden="true"
					className="lg-range-outline"
					data-top={!!(selectionMask & SelectionEdge.top) || undefined}
					data-right={!!(selectionMask & SelectionEdge.right) || undefined}
					data-bottom={!!(selectionMask & SelectionEdge.bottom) || undefined}
					data-left={!!(selectionMask & SelectionEdge.left) || undefined}
				>
					{OUTLINE_EDGES.map(([edge, mask]) =>
						selectionMask & mask ? (
							<span key={edge} className="lg-range-edge" data-edge={edge} />
						) : null,
					)}
					{CONCAVE_CORNERS.map(([corner, mask]) =>
						selectionMask & mask ? (
							<span
								key={corner}
								className="lg-range-corner"
								data-corner={corner}
							/>
						) : null,
					)}
				</span>
			)}
			{editing && <span aria-hidden="true" className="lg-edit-outline" />}
		</div>
	);
}

export const GridCell = memo(GridCellView) as typeof GridCellView;
