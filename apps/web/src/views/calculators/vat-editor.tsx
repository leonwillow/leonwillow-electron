/**
 * @file 增值税方案的汇总、筛选、录入与导出工作区。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：以现有共享组件适配 V5 逻辑，全部月份通过虚拟滚动展示，工具栏筛选不改变全期间计算结果。
 * 被调用：CalculatorsView；调用：共享算法、方案保存 Hook、导入弹窗、Lattice Grid 业务适配。
 * 预期结果：四项增减分别保存，清空调整需确认，新备份保留四项金额并兼容恢复旧 V5 数据。
 */
import {
	calculate,
	changed,
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
import ImportDialog from "./import-dialog";
import ScenarioHeader from "./scenario-header";
import { useVatScenario } from "./use-vat-scenario";
import { applyVatGridChanges } from "./vat-grid-model";
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
	const [importing, setImporting] = useState<{ month?: string } | null>(null);
	const [clearing, setClearing] = useState(false);
	const years = [...new Set(result.rows.map((row) => row.month.slice(0, 4)))];
	const visible = result.rows.filter(
		(row) =>
			(year === "all" || row.month.startsWith(year)) &&
			(!changedOnly || changed(row)),
	);
	const apply = async (data: VatData) => {
		if (editor.readOnly) return false;
		editor.change({ ...draft, ...data });
		return editor.persist();
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
	const toolbarContent = (
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
			<Button variant="outline" onClick={exportBackup}>
				<FileJsonIcon data-icon="inline-start" />
				导出方案
			</Button>
			<Button
				variant="outline"
				disabled={!result.allReady || !result.audit}
				disabledReason="全部月份计算及金额平衡校验通过后可导出"
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
			>
				<DownloadIcon data-icon="inline-start" />
				导出明细
			</Button>
			<Button
				variant="warning"
				disabled={editor.readOnly || !Object.keys(draft.adjustments).length}
				disabledReason={editor.readOnly ? "当前方案不可编辑" : "当前没有调整"}
				onClick={() => setClearing(true)}
			>
				<RotateCcwIcon data-icon="inline-start" />
				清空调整
			</Button>
		</>
	);
	return (
		<>
			<ScenarioHeader
				kind="vat"
				name={draft.name}
				onNameChange={(name) => editor.change({ ...draft, name })}
				editor={editor}
			>
				<Button
					disabled={editor.readOnly}
					disabledReason="请先在目录中恢复方案或等待当前操作结束"
					onClick={() => setImporting({})}
				>
					<UploadIcon data-icon="inline-start" />
					导入历史
				</Button>
			</ScenarioHeader>
			<ScrollArea
				className="min-h-0 flex-1"
				contentClassName="w-full min-w-0! p-workspace-gutter"
			>
				<div className="flex min-w-0 flex-col gap-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{[
							[
								"原应纳税额合计",
								result.totals.oldTax,
								`${draft.history.length} 个月 · 历史申报值`,
							],
							[
								"调整后应纳合计",
								result.totals.newTax,
								result.allReady ? "全部月份已重算" : "待补齐历史或修正调整",
							],
							[
								"应纳税额净变化",
								result.totals.delta,
								result.allReady
									? `增加 ${money(result.totals.increase)} / 减少 ${money(result.totals.decrease)}`
									: "完整计算后显示",
							],
							[
								"末月调整后留抵",
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
							末月新旧留抵相差 {money(result.totals.carryDelta)}{" "}
							元，需补入后续月份才能继续测算剩余影响。
						</p>
					)}
					<VatTable
						readOnly={editor.readOnly}
						rows={visible}
						adjustments={draft.adjustments}
						toolbarContent={toolbarContent}
						emptyContent={
							!draft.history.length ? (
								<div className="flex flex-col items-center gap-3">
									<p>尚未录入历史数据</p>
									<Button
										variant="outline"
										disabled={editor.readOnly}
										disabledReason="当前方案不可编辑"
										onClick={() =>
											setImporting({
												month: new Date().toISOString().slice(0, 7),
											})
										}
									>
										手工录入首月
									</Button>
								</div>
							) : undefined
						}
						addMonth={(month) => setImporting({ month })}
						change={(changes) =>
							editor.change({
								...draft,
								adjustments: applyVatGridChanges(draft.adjustments, changes),
							})
						}
					/>
					<details className="rounded-lg border p-3 text-xs">
						<summary className="cursor-pointer font-medium">
							计算口径与数据来源
						</summary>
						<div className="mt-3 flex flex-col gap-2 text-muted-foreground">
							<p>
								可抵扣额 = 进项 + 上月留抵 − 进项转出；应纳 = max(销项 −
								可抵扣额, 0)；留抵 = max(可抵扣额 − 销项, 0)。
							</p>
							<p>
								调整后销项 = 原销项 + 调增销项 − 调减销项；调整后进项 = 原进项 +
								调增进项 − 调减进项。四项调整均填写非负金额。
							</p>
							<p>
								首月反推期初留抵 {money(result.opening)}{" "}
								元。缺月、历史口径不一致或无效调整会阻断后续月份。
							</p>
							<p>
								适用于一般纳税人普通计税测算，未包含简易计税、减免、加计抵减、出口等特殊事项。应纳增减不等同实际补缴或退税金额。
							</p>
							<p>
								数据来源：{draft.source || "尚未录入"}
								。金额按整数分运算；历史保存后不可覆盖。
							</p>
						</div>
					</details>
				</div>
				{importing && (
					<ImportDialog
						data={draft}
						month={importing.month}
						onClose={() => setImporting(null)}
						onApply={apply}
					/>
				)}
				<Dialog open={clearing} onOpenChange={setClearing}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>清空全部调整？</DialogTitle>
							<DialogDescription>
								清空调增销项、调减销项、调增进项和调减进项，已锁定历史保留。清空后将保存到数据库。
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
