/**
 * @file 增值税方案的汇总、筛选、录入与导出工作区。
 * 创建时间：2026-11-05；修改时间：2026-11-21。
 * 版本作用：表格填满统计卡下方的剩余空间，全部所属期通过虚拟滚动展示；memo 化表格与插槽，隔离顶栏方案名输入重绘。
 * 被调用：CalculatorsView；调用：共享算法、方案保存 Hook、导入弹窗、Lattice Grid 业务适配。
 * 预期结果：四项增减分别保存，清空调整需确认，修改方案名不触发重型虚拟表格重绘。
 */

import {
	adjustmentFields,
	calculate,
	cents,
	changed,
	insertVatRows,
	money,
	RULES_VERSION,
	resultCsv,
	type VatData,
} from "@leonwillow-electron/calculators";
import type { InsertRowsRequest } from "@leonwillow-electron/lattice-grid";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { ConfirmDialog } from "@leonwillow-electron/ui/components/confirm-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import { Label } from "@leonwillow-electron/ui/components/label";
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
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import {
	CalendarPlusIcon,
	ChevronDownIcon,
	DownloadIcon,
	FileJsonIcon,
	RotateCcwIcon,
	UploadIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	calculatorError,
	downloadCalculation,
	type VatScenario,
} from "@/lib/calculators";
import { randomUUID } from "@/lib/uuid";
import ImportDialog from "./import-dialog";
import ScenarioHeader from "./scenario-header";
import { useVatScenario } from "./use-vat-scenario";
import VatCalculationNotes from "./vat-calculation-notes";
import type { VatGridRow } from "./vat-grid-model";
import VatTable from "./vat-table";

export default function VatEditor({
	record,
	onSaved,
}: {
	record: VatScenario;
	onSaved: (row: VatScenario) => void;
}) {
	const editor = useVatScenario(record, onSaved);
	const { draft, change: setDraft, readOnly } = editor;
	const draftRef = useRef(draft);
	draftRef.current = draft;

	const vatData = useMemo<VatData>(
		() => ({
			source: draft.source,
			history: draft.history,
			adjustments: draft.adjustments,
		}),
		[draft.source, draft.history, draft.adjustments],
	);
	const result = useMemo(
		() => calculate(draft.history, draft.adjustments),
		[draft.history, draft.adjustments],
	);
	const [year, setYear] = useState("all");
	const [changedOnly, setChangedOnly] = useState(false);
	const [importing, setImporting] = useState(false);
	const [clearing, setClearing] = useState(false);
	const [revealRowId, setRevealRowId] = useState<string>();

	const years = useMemo(
		() =>
			[
				...new Set(
					result.rows
						.flatMap((row) => [
							row.periodStart.slice(0, 4),
							row.periodEnd.slice(0, 4),
						])
						.filter(Boolean),
				),
			].sort(),
		[result.rows],
	);
	const visible = useMemo(
		() =>
			result.rows.filter(
				(row) =>
					(year === "all" ||
						!row.periodStart ||
						!row.periodEnd ||
						(row.periodStart <= `${year}-12-31` &&
							row.periodEnd >= `${year}-01-01`)) &&
					(!changedOnly || changed(row)),
			),
		[result.rows, year, changedOnly],
	);

	const apply = useCallback(
		async (data: VatData) => {
			if (readOnly) return false;
			return editor.apply((prev) => ({ ...prev, ...data }));
		},
		[readOnly, editor.apply],
	);

	const insertRows = useCallback(
		(anchorId: string | null, position: "above" | "below", count = 1) => {
			if (readOnly) throw Error("当前方案不可编辑");
			const ids = Array.from({ length: count }, () => randomUUID());
			const current = draftRef.current;
			const next = insertVatRows(current, anchorId, position, ids);
			setYear("all");
			setChangedOnly(false);
			setDraft({ ...current, ...next });
			setRevealRowId(ids[0]);
			toast.success(`已插入 ${count} 行`, {
				description: "点击“所属期”，选择年份和月份或季度。",
			});
		},
		[readOnly, setDraft],
	);

	const appendRow = useCallback(() => {
		try {
			insertRows(null, "below");
		} catch (error) {
			toast.error("无法插入行", { description: calculatorError(error) });
		}
	}, [insertRows]);

	const handleGridInsert = useCallback(
		({ rowId, position, count }: InsertRowsRequest<VatGridRow>) =>
			insertRows(rowId, position, count),
		[insertRows],
	);

	const handleGridChange = useCallback(
		(data: VatData) => setDraft((prev) => ({ ...prev, ...data })),
		[setDraft],
	);

	const handleNameChange = useCallback(
		(name: string) => setDraft((prev) => ({ ...prev, name })),
		[setDraft],
	);

	const exportBackup = useCallback(() => {
		const current = draftRef.current;
		downloadCalculation(
			`${current.name || "增值税测算"}.json`,
			JSON.stringify(
				{
					schema: RULES_VERSION,
					source: current.source,
					history: current.history,
					adjustments: current.adjustments,
					savedAt: new Date().toISOString(),
				},
				null,
				2,
			),
			"application/json",
		);
	}, []);

	const hasAdjustments = Object.values(draft.adjustments).some((entry) =>
		adjustmentFields.some((key) => entry[key] !== ""),
	);
	const toolbarSlots = useMemo(
		() => ({
			filters: (
				<>
					<Select
						value={year}
						onValueChange={(v) => {
							setYear(v ?? "all");
						}}
					>
						<SelectTrigger aria-label="筛选年度">
							<SelectValue>
								{year === "all" ? "全部年度" : `${year} 年`}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="all">全部年度</SelectItem>
								{years.map((y) => (
									<SelectItem key={y} value={y}>
										{y} 年
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Label className="flex items-center gap-2">
						<Checkbox
							checked={changedOnly}
							onCheckedChange={(checked) => {
								setChangedOnly(!!checked);
							}}
						/>
						仅看调整或联动
					</Label>
				</>
			),
			actions: (
				<Button
					variant="outline"
					disabled={readOnly}
					disabledReason="当前方案不可编辑"
					onClick={appendRow}
				>
					<CalendarPlusIcon data-icon="inline-start" />
					新增一行
				</Button>
			),
			actionsEnd: (
				<Button
					variant="warning"
					disabled={readOnly || !hasAdjustments}
					disabledReason={readOnly ? "当前方案不可编辑" : "当前没有调整"}
					onClick={() => setClearing(true)}
				>
					<RotateCcwIcon data-icon="inline-start" />
					清空调整
				</Button>
			),
			exports: (
				<DropdownMenu>
					<DropdownMenuTrigger
						openOnHover
						delay={100}
						closeDelay={150}
						render={<Button variant="outline" />}
					>
						<DownloadIcon data-icon="inline-start" />
						导出
						<ChevronDownIcon data-icon="inline-end" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuGroup>
							<DropdownMenuItem onClick={exportBackup}>
								<FileJsonIcon />
								导出方案
							</DropdownMenuItem>
							<Tooltip
								disabled={result.allReady && !!result.audit}
								disableHoverablePopup
							>
								<TooltipTrigger
									render={
										<DropdownMenuItem
											disabled={!result.allReady || !result.audit}
											className="data-disabled:pointer-events-auto data-disabled:cursor-not-allowed"
											onClick={() => {
												try {
													downloadCalculation(
														`${draftRef.current.name}-测算明细.csv`,
														resultCsv(result),
														"text/csv;charset=utf-8",
													);
												} catch (error) {
													toast.error(calculatorError(error));
												}
											}}
										/>
									}
								>
									<DownloadIcon />
									导出明细
								</TooltipTrigger>
								<TooltipContent>
									全部所属期计算及金额平衡校验通过后可导出
								</TooltipContent>
							</Tooltip>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			),
		}),
		[
			year,
			years,
			changedOnly,
			readOnly,
			appendRow,
			hasAdjustments,
			exportBackup,
			result,
		],
	);

	const emptyContent = useMemo(
		() =>
			!draft.history.length ? (
				<div className="flex flex-col items-center gap-3">
					<p>尚未录入历史数据</p>
					<Button
						variant="outline"
						disabled={readOnly}
						disabledReason="当前方案不可编辑"
						onClick={appendRow}
					>
						插入第一行
					</Button>
				</div>
			) : undefined,
		[draft.history.length, readOnly, appendRow],
	);

	const displayOpening = useMemo(() => {
		const first = result.rows
			.filter((row) => row.periodStart && row.periodEnd && row.h)
			.toSorted((a, b) => a.periodStart.localeCompare(b.periodStart))[0];
		if (!first?.h) return null;
		if (cents(first.h.tax) > 0 && cents(first.h.end) > 0) return null;
		return result.opening;
	}, [result.rows, result.opening]);

	const helpNotes = useMemo(
		() => (
			<VatCalculationNotes opening={displayOpening} source={draft.source} />
		),
		[displayOpening, draft.source],
	);

	return (
		<>
			<ScenarioHeader
				kind="vat"
				name={draft.name}
				onNameChange={handleNameChange}
				editor={editor}
				help={helpNotes}
			>
				<Button
					disabled={readOnly}
					disabledReason="请先在目录中恢复方案或等待当前操作结束"
					onClick={() => setImporting(true)}
				>
					<UploadIcon data-icon="inline-start" />
					导入历史
				</Button>
			</ScenarioHeader>
			<ScrollArea
				className="min-h-0 flex-1"
				contentClassName="flex w-full min-w-0! flex-col p-workspace-gutter"
			>
				<div className="flex min-w-0 flex-1 flex-col gap-workspace-gutter">
					<div className="grid shrink-0 grid-cols-1 gap-workspace-gutter sm:grid-cols-2 xl:grid-cols-4">
						{[
							[
								"原应纳税额合计",
								result.totals.oldTax,
								`${draft.history.length} 期 · 原始申报值`,
							],
							[
								"调整后应纳合计",
								result.totals.newTax,
								result.allReady ? "全部所属期已重算" : "待补齐历史或修正调整",
							],
							[
								"应纳税额净变化",
								result.totals.delta,
								result.allReady
									? `增加 ${money(result.totals.increase)} / 减少 ${money(result.totals.decrease)}`
									: "完整计算后显示",
							],
							[
								"末期调整后留抵",
								result.totals.end,
								result.allReady
									? `留抵变化 ${money(result.totals.carryDelta)}`
									: "完整计算后显示",
							],
						].map(([label, value, note]) => (
							<section
								key={String(label)}
								className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4"
							>
								<h2 className="text-muted-foreground text-xs">{label}</h2>
								<p className="break-all font-semibold text-xl tabular-nums">
									{money(value as number | null)}
									<span className="ml-1 font-normal text-muted-foreground text-xs">
										元
									</span>
								</p>
								<p className="text-muted-foreground text-xs">{note}</p>
							</section>
						))}
					</div>
					{result.allReady && result.totals.carryDelta !== 0 && (
						<p className="text-warning-foreground text-xs">
							末期新旧留抵相差 {money(result.totals.carryDelta)}{" "}
							元，需补入后续所属期才能继续测算剩余影响。
						</p>
					)}
					<VatTable
						revealRowId={revealRowId}
						readOnly={readOnly}
						rows={visible}
						adjustments={draft.adjustments}
						toolbarSlots={toolbarSlots}
						emptyContent={emptyContent}
						data={vatData}
						insert={handleGridInsert}
						change={handleGridChange}
					/>
				</div>
				{importing && (
					<ImportDialog
						data={vatData}
						onClose={() => setImporting(false)}
						onApply={apply}
					/>
				)}
				<ConfirmDialog
					open={clearing}
					title="清空全部调整？"
					confirmLabel="确认清空"
					confirmVariant="warning-solid"
					showCloseButton
					disabled={editor.saving || readOnly}
					onClose={() => setClearing(false)}
					onConfirm={() => {
						void (async () => {
							if (await apply({ ...vatData, adjustments: {} })) {
								setClearing(false);
								toast.success("调整已清空并保存");
							}
						})();
					}}
				>
					清空调增销项、调减销项、调增进项和调减进项，原始申报保留。清空后将保存到数据库。
				</ConfirmDialog>
				<ConfirmDialog
					open={editor.blocker.status === "blocked"}
					title="方案尚未保存"
					cancelLabel="继续编辑"
					cancelVariant="default"
					confirmLabel="放弃未保存内容并离开"
					confirmVariant="warning-solid"
					showCloseButton
					extraActions={
						<Button variant="outline" onClick={exportBackup}>
							导出备份
						</Button>
					}
					onClose={() => editor.blocker.reset?.()}
					onConfirm={() => editor.blocker.proceed?.()}
				>
					保存未成功，请先导出当前方案备份，或留在页面重试。
				</ConfirmDialog>
			</ScrollArea>
		</>
	);
}
