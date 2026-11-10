/**
 * @file 增值税方案的汇总、筛选、录入与导出工作区。
 * 创建时间：2026-11-05；修改时间：2026-11-08。
 * 版本作用：表格填满统计卡下方的剩余空间，全部所属期通过虚拟滚动展示，工具栏筛选不改变全期间计算结果。
 * 被调用：CalculatorsView；调用：共享算法、方案保存 Hook、导入弹窗、Lattice Grid 业务适配。
 * 预期结果：四项增减分别保存，清空调整需确认，新备份保留四项金额并兼容恢复旧 V5 数据。
 */

import {
	calculate,
	changed,
	insertVatRows,
	money,
	RULES_VERSION,
	resultCsv,
	type VatData,
} from "@leonwillow-electron/calculators";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
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
import { useMemo, useState } from "react";
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
import VatTable from "./vat-table";

export default function VatEditor({
	record,
	onSaved,
}: {
	record: VatScenario;
	onSaved: (row: VatScenario) => void;
}) {
	const editor = useVatScenario(record, onSaved);
	const { draft } = editor;
	const result = useMemo(
		() => calculate(draft.history, draft.adjustments),
		[draft.history, draft.adjustments],
	);
	const [year, setYear] = useState("all");
	const [changedOnly, setChangedOnly] = useState(false);
	const [importing, setImporting] = useState(false);
	const [clearing, setClearing] = useState(false);
	const [revealRowId, setRevealRowId] = useState<string>();
	const years = [
		...new Set(
			result.rows
				.flatMap((row) => [
					row.periodStart.slice(0, 4),
					row.periodEnd.slice(0, 4),
				])
				.filter(Boolean),
		),
	].sort();
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
	const apply = async (data: VatData) => {
		if (editor.readOnly) return false;
		editor.change({ ...draft, ...data });
		return editor.persist();
	};
	const insertRows = (
		anchorId: string | null,
		position: "above" | "below",
		count = 1,
	) => {
		if (editor.readOnly) throw Error("当前方案不可编辑");
		const ids = Array.from({ length: count }, () => randomUUID());
		const next = insertVatRows(draft, anchorId, position, ids);
		setYear("all");
		setChangedOnly(false);
		editor.change({ ...draft, ...next });
		setRevealRowId(ids[0]);
		toast.success(`已插入 ${count} 行`, {
			description: "点击“所属期”，选择年份和月份或季度。",
		});
	};
	const appendRow = () => {
		try {
			insertRows(null, "below");
		} catch (error) {
			toast.error("无法插入行", { description: calculatorError(error) });
		}
	};
	const exportBackup = () =>
		downloadCalculation(
			`${draft.name || "增值税测算"}.json`,
			JSON.stringify(
				{
					schema: RULES_VERSION,
					source: draft.source,
					history: draft.history,
					adjustments: draft.adjustments,
					savedAt: new Date().toISOString(),
				},
				null,
				2,
			),
			"application/json",
		);
	const toolbarSlots = {
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
				disabled={editor.readOnly}
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
				disabled={editor.readOnly || !Object.keys(draft.adjustments).length}
				disabledReason={editor.readOnly ? "当前方案不可编辑" : "当前没有调整"}
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
													`${draft.name}-测算明细.csv`,
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
	};
	return (
		<>
			<ScenarioHeader
				kind="vat"
				name={draft.name}
				onNameChange={(name) => editor.change({ ...draft, name })}
				editor={editor}
				help={
					<VatCalculationNotes opening={result.opening} source={draft.source} />
				}
			>
				<Button
					disabled={editor.readOnly}
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
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					<div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
						readOnly={editor.readOnly}
						rows={visible}
						adjustments={draft.adjustments}
						toolbarSlots={toolbarSlots}
						emptyContent={
							!draft.history.length ? (
								<div className="flex flex-col items-center gap-3">
									<p>尚未录入历史数据</p>
									<Button
										variant="outline"
										disabled={editor.readOnly}
										disabledReason="当前方案不可编辑"
										onClick={appendRow}
									>
										插入第一行
									</Button>
								</div>
							) : undefined
						}
						data={draft}
						insert={({ rowId, position, count }) =>
							insertRows(rowId, position, count)
						}
						change={(data) => editor.change({ ...draft, ...data })}
					/>
				</div>
				{importing && (
					<ImportDialog
						data={draft}
						onClose={() => setImporting(false)}
						onApply={apply}
					/>
				)}
				<Dialog open={clearing} onOpenChange={setClearing}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>清空全部调整？</DialogTitle>
							<DialogDescription>
								清空调增销项、调减销项、调增进项和调减进项，原始申报保留。清空后将保存到数据库。
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => setClearing(false)}>
								取消
							</Button>
							<Button
								variant="warning"
								disabled={editor.saving || editor.readOnly}
								onClick={async () => {
									if (await apply({ ...draft, adjustments: {} })) {
										setClearing(false);
										toast.success("调整已清空并保存");
									}
								}}
							>
								确认清空
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<Dialog
					open={editor.blocker.status === "blocked"}
					onOpenChange={(open) => {
						if (!open) editor.blocker.reset?.();
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>方案尚未保存</DialogTitle>
							<DialogDescription>
								保存未成功，请先导出当前方案备份，或留在页面重试。
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={exportBackup}>
								导出备份
							</Button>
							<Button onClick={() => editor.blocker.reset?.()}>继续编辑</Button>
							<Button
								variant="warning"
								onClick={() => editor.blocker.proceed?.()}
							>
								放弃未保存内容并离开
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</ScrollArea>
		</>
	);
}
