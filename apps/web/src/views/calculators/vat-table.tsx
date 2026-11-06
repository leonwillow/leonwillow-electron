/**
 * @file 以共享 Lattice Grid 呈现增值税逐月历史、调整及联动结果。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：税务表格作为可复用 Grid 的业务消费者，保留分组、状态和补录入口。
 * 被调用：VatEditor；调用：lattice-grid、VAT 列适配、共享按钮与 Tooltip。
 * 预期结果：只改调整列，批量粘贴、撤销与重做通过同一次保存快照联动重算。
 */
import {
	type Adjustments,
	adjustmentFields,
	type CalculationRow,
} from "@leonwillow-electron/calculators";
import { DataGrid, getCellValue } from "@leonwillow-electron/lattice-grid";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { InfoIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { toast } from "sonner";
import {
	type VatGridChange,
	vatGridChanges,
	vatGridColumns,
	vatGridRowId,
	vatGridRows,
} from "./vat-grid-model";

export default function VatTable({
	rows,
	adjustments,
	change,
	addMonth,
	readOnly = false,
	toolbarContent,
	emptyContent,
}: {
	rows: CalculationRow[];
	adjustments: Adjustments;
	change: (changes: readonly VatGridChange[]) => void;
	addMonth: (month: string) => void;
	readOnly?: boolean;
	toolbarContent?: ReactNode;
	emptyContent?: ReactNode;
}) {
	const data = useMemo(
		() => vatGridRows(rows, adjustments),
		[rows, adjustments],
	);
	return (
		<DataGrid
			label="增值税逐月测算"
			rows={data}
			columns={vatGridColumns}
			getRowId={vatGridRowId}
			reconcileRows="editable"
			readOnly={readOnly}
			exportable={false}
			statusBar={false}
			toolbarContent={toolbarContent}
			renderEmpty={emptyContent ? () => emptyContent : undefined}
			onRowsChange={(next, transaction) => {
				const changes = vatGridChanges(transaction.previousRows, next);
				if (changes.length) change(changes);
			}}
			renderCell={({ row, column }) => {
				const value = getCellValue(row, column);
				if (column.id === "month")
					return (
						<div className="flex min-w-0 items-center gap-2">
							<span className="shrink-0">{row.month}</span>
							{!row.h && (
								<Button
									size="sm"
									variant="outline"
									disabled={readOnly}
									disabledReason="当前方案不可编辑"
									onClick={(event) => {
										event.stopPropagation();
										addMonth(row.month);
									}}
								>
									补录
								</Button>
							)}
							{row.error && (
								<Tooltip disableHoverablePopup>
									<TooltipTrigger
										render={
											<Button
												variant="warning"
												size="icon-xs"
												aria-label={`${row.month} 计算说明`}
												onClick={(event) => {
													event.stopPropagation();
													toast.warning(`${row.month} 计算暂停`, {
														description: row.error,
													});
												}}
											/>
										}
									>
										<InfoIcon />
									</TooltipTrigger>
									<TooltipContent>{row.error}</TooltipContent>
								</Tooltip>
							)}
							<span
								className={
									row.h
										? "min-w-0 truncate text-muted-foreground text-xs"
										: "sr-only"
								}
							>
								{row.status === "gap"
									? "缺少历史"
									: row.status === "error"
										? "需要核对"
										: row.status === "blocked"
											? "等待前月"
											: adjustmentFields.some((key) => row[key] !== 0)
												? "已调整"
												: row.delta || row.carryDelta
													? "留抵联动"
													: "已锁定"}
							</span>
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
					return (
						<span className="text-muted-foreground">
							{column.format?.(value, row, "zh-CN")}
						</span>
					);
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
			}}
		/>
	);
}
