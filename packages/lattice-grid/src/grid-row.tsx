// biome-ignore-all lint/a11y/useSemanticElements: Virtualized ARIA rows are positioned independently of native table layout.
// biome-ignore-all lint/a11y/useFocusableInteractive: The grid owns keyboard focus and exposes its active cell through aria-activedescendant.
/**
 * @file 网格正文行的局部更新边界。
 * 创建时间：2026-11-07；修改时间：2026-11-07。
 * 版本作用：以稳定行、布局和该行选区隔离其他行的输入及选中变化。
 * 被调用：DataGrid；调用：GridCell、共享 Checkbox 和 GridView。
 * 预期结果：保留稳定 DOM 身份、虚拟行位置及冻结样式，只更新受影响行和单元格。
 */
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { memo, type ReactNode } from "react";
import { GridCell } from "./grid-cell";
import type { CellContext, EditorContext, GridView } from "./view-controller";

function GridRowView<T>({
	id,
	view,
	row,
	rowId,
	rowIndex,
	rowHeight,
	headerRows,
	last,
	checked,
	selectLabel,
	layout,
	selectionStart,
	selectionEnd,
	activeColumn,
	editingColumn,
	error,
	disabled,
	pending,
	movedColumn,
	moveMarker,
	locale,
	renderCell,
	renderEditor,
}: {
	id: string;
	view: GridView<T>;
	row: T;
	rowId: string;
	rowIndex: number;
	rowHeight: number;
	headerRows: number;
	last: boolean;
	checked: boolean;
	selectLabel: string;
	layout: ReturnType<GridView<T>["layout"]>;
	selectionStart: number;
	selectionEnd: number;
	activeColumn?: string;
	editingColumn?: string;
	error: string;
	disabled: boolean;
	pending: boolean;
	movedColumn?: string;
	moveMarker?: string;
	locale: string;
	renderCell?: (context: CellContext<T>) => ReactNode;
	renderEditor?: (context: EditorContext<T>) => ReactNode;
}) {
	return (
		<div
			role="row"
			aria-rowindex={rowIndex + headerRows + 1}
			aria-selected={checked}
			className="lg-row"
			data-last-row={last || undefined}
			style={{ top: rowIndex * rowHeight, height: rowHeight }}
			data-checked={checked || undefined}
		>
			<div role="rowheader" aria-colindex={1} className="lg-gutter">
				<span className="lg-row-number">{rowIndex + 1}</span>
				<Checkbox
					className="lg-row-check"
					tabIndex={-1}
					aria-label={`${selectLabel} ${rowIndex + 1}`}
					checked={checked}
					onCheckedChange={() => view.store.toggleRow(rowId)}
				/>
			</div>
			{layout.map((c, index) => {
				const editing = editingColumn === c.column.id;
				return (
					<GridCell
						key={c.column.id}
						id={id}
						view={view}
						row={row}
						rowId={rowId}
						rowIndex={rowIndex}
						column={c.column}
						columnIndex={index}
						width={c.width}
						pinLeft={c.pinned ? c.pinLeft : undefined}
						selected={
							selectionStart >= 0 &&
							index >= selectionStart &&
							index <= selectionEnd
						}
						active={activeColumn === c.column.id}
						editable={!disabled && view.store.isEditable(row, c.column)}
						editing={editing}
						error={editing ? error : ""}
						pending={editing && pending}
						moveMarker={movedColumn === c.column.id ? moveMarker : undefined}
						locale={locale}
						renderCell={renderCell}
						renderEditor={renderEditor}
					/>
				);
			})}
		</div>
	);
}

export const GridRow = memo(GridRowView) as typeof GridRowView;
