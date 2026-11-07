/**
 * @file 以共享 Lattice Grid 呈现增值税所属期申报、调整及联动结果。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 版本作用：税务表格作为可复用 Grid 的业务消费者，保留分组、状态和补录入口。
 * 被调用：VatEditor；调用：lattice-grid、VAT 列适配、共享按钮与 Tooltip。
 * 预期结果：原始申报与调整均可修改，批量粘贴、撤销与重做通过同一方案快照联动重算。
 */
import {
	type Adjustments,
	adjustmentFields,
	type CalculationRow,
	periodLabel,
	type VatData,
} from "@leonwillow-electron/calculators";
import {
	type CellContext,
	DataGrid,
	type EditorContext,
	type GridStore,
	getCellValue,
	type InsertRowsRequest,
} from "@leonwillow-electron/lattice-grid";
import { Button } from "@leonwillow-electron/ui/components/button";
import { DatePicker } from "@leonwillow-electron/ui/components/date-picker";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { InfoIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
	applyVatGridTransaction,
	type VatGridRow,
	vatGridColumns,
	vatGridRowId,
	vatGridRows,
} from "./vat-grid-model";

function PeriodEditor({ context }: { context: EditorContext<VatGridRow> }) {
	const selected = useRef(false);
	const adjacentDate =
		context.column.id === "periodEnd"
			? context.row.periodStart
			: context.row.periodEnd;
	return (
		<DatePicker
			defaultOpen
			data-lg-editor
			value={context.initialValue}
			defaultMonth={
				adjacentDate ? new Date(`${adjacentDate}T12:00:00`) : undefined
			}
			endMonth={new Date(2199, 11)}
			displayFormat="yyyy-MM-dd"
			className="lg-date-editor"
			editScope={context.editScope}
			aria-label={`选择${context.column.header}`}
			onValueChange={(value) => {
				selected.current = true;
				void context.commit(value).then((ok) => {
					if (!ok) selected.current = false;
				});
			}}
			onOpenChange={(open) => {
				if (!open && !selected.current) context.cancel();
			}}
		/>
	);
}

function renderVatEditor(context: EditorContext<VatGridRow>) {
	return context.column.id === "periodStart" ||
		context.column.id === "periodEnd" ? (
		<PeriodEditor context={context} />
	) : undefined;
}

function renderVatCell({ row, column }: CellContext<VatGridRow>) {
	const value = getCellValue(row, column);
	if (column.id === "periodStart" || column.id === "periodEnd")
		return (
			<div className="flex w-full min-w-0 items-center gap-2">
				<span className={!value ? "text-muted-foreground" : undefined}>
					{String(value || "选择日期")}
				</span>
				{column.id === "periodEnd" && row.error && (
					<Tooltip disableHoverablePopup>
						<TooltipTrigger
							render={
								<Button
									variant="warning"
									className="ml-auto"
									size="icon-xs"
									aria-label={`${periodLabel(row)} 计算说明`}
									onClick={(event) => {
										event.stopPropagation();
										toast.warning("计算暂停", { description: row.error });
									}}
								/>
							}
						>
							<InfoIcon />
						</TooltipTrigger>
						<TooltipContent>{row.error}</TooltipContent>
					</Tooltip>
				)}
			</div>
		);
	if (!row.h) return <span className="text-muted-foreground">—</span>;
	if (adjustmentFields.some((key) => key === column.id))
		return (
			<span className="block text-right tabular-nums">
				{column.format?.(value, row, "zh-CN")}
			</span>
		);
	if (column.id.startsWith("history-"))
		return <span>{column.format?.(value, row, "zh-CN")}</span>;
	if (column.id === "delta")
		return (
			<span
				className={
					row.delta && row.delta > 0
						? "text-warning-foreground"
						: row.delta && row.delta < 0
							? "text-info-foreground"
							: undefined
				}
			>
				{column.format?.(value, row, "zh-CN")}
			</span>
		);
	return undefined;
}

export default function VatTable({
	rows,
	adjustments,
	change,
	data: source,
	insert,
	revealRowId,
	readOnly = false,
	toolbarContent,
	emptyContent,
}: {
	rows: CalculationRow[];
	adjustments: Adjustments;
	change: (data: VatData) => void;
	data: VatData;
	insert: (request: InsertRowsRequest<VatGridRow>) => void | Promise<void>;
	revealRowId?: string;
	readOnly?: boolean;
	toolbarContent?: ReactNode;
	emptyContent?: ReactNode;
}) {
	const grid = useRef<GridStore<VatGridRow>>(null);
	const revealCell = useMemo(
		() =>
			revealRowId ? { rowId: revealRowId, columnId: "periodStart" } : null,
		[revealRowId],
	);
	useEffect(() => {
		if (revealRowId)
			grid.current?.setState(
				{ search: "", filters: {}, sorting: [] },
				"insert",
			);
	}, [revealRowId]);
	const data = useMemo(
		() => vatGridRows(rows, adjustments, source.history),
		[rows, adjustments, source.history],
	);
	return (
		<DataGrid
			apiRef={grid}
			revealCell={revealCell}
			label="增值税所属期测算"
			fillHeight
			rows={data}
			columns={vatGridColumns}
			getRowId={vatGridRowId}
			reconcileRows="editable"
			readOnly={readOnly}
			allowDelete
			exportable={false}
			statusBar={false}
			toolbarContent={toolbarContent}
			renderEmpty={emptyContent ? () => emptyContent : undefined}
			onInsertRows={insert}
			onCommit={(transaction) => {
				applyVatGridTransaction(
					source,
					transaction.previousRows,
					transaction.rows,
				);
			}}
			renderEditor={renderVatEditor}
			onRowsChange={(next, transaction) => {
				change(applyVatGridTransaction(source, transaction.previousRows, next));
			}}
			renderCell={renderVatCell}
		/>
	);
}
