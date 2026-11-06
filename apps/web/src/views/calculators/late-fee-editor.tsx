/**
 * @file 滞纳金方案的录入、汇总、规则说明与保存工作区。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：共享保存队列保护切换与刷新；所有结果通过同一领域算法计算。
 * 被调用：LateFeesView；调用：LateFeeLiability、useScenario、共享控件与 Eden。
 * 预期结果：多税种、多次缴款可持久化，未完成录入不展示误导合计。
 */
import { money } from "@leonwillow-electron/calculators";
import {
	calculateLateFees,
	LATE_FEE_RULES,
	MAX_LIABILITIES,
	type TaxLiability,
} from "@leonwillow-electron/calculators/late-fees";
import { Button } from "@leonwillow-electron/ui/components/button";
import { DatePicker } from "@leonwillow-electron/ui/components/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { CalculatorIcon, FileJsonIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { downloadCalculation } from "@/lib/calculators";
import { type LateFeeScenario, saveLateFee } from "@/lib/late-fees";
import LateFeeLiability, { firstDate, lastDate } from "./late-fee-liability";
import ScenarioHeader from "./scenario-header";
import { useScenario } from "./use-scenario";
export default function LateFeeEditor({
	record,
	onSaved,
}: {
	record: LateFeeScenario;
	onSaved: (row: LateFeeScenario) => void;
}) {
	const editor = useScenario(
		record,
		{
			name: record.name,
			cutoff: record.cutoff,
			liabilities: record.liabilities,
		},
		saveLateFee,
		onSaved,
		"late-fees",
	);
	const { draft } = editor;
	const result = useMemo(() => calculateLateFees(draft), [draft]);
	const [removing, setRemoving] = useState<string | null>(null);
	const exportBackup = () =>
		downloadCalculation(
			`${draft.name || "滞纳金测算"}.json`,
			JSON.stringify(
				{
					schema: LATE_FEE_RULES,
					...draft,
					result,
					savedAt: new Date().toISOString(),
				},
				null,
				2,
			),
			"application/json",
		);
	const validate = () => {
		const problems = [
			result.error,
			...result.rows.map((r, i) =>
				r.error ? `第${i + 1}笔：${r.error}` : null,
			),
		].filter(Boolean);
		if (problems.length)
			toast.error("请完善测算资料", {
				description: problems.slice(0, 3).join("；"),
			});
		else
			toast.success("测算完成", {
				description: `共${draft.liabilities.length}笔税款，累计滞纳金${money(result.totals?.fee ?? null)}元`,
			});
	};
	const add = () => {
		if (draft.liabilities.length >= MAX_LIABILITIES) return;
		const row: TaxLiability = {
			id: crypto.randomUUID(),
			taxType: "vat",
			period: "",
			principal: "",
			deadline: "",
			note: "",
			payments: [],
		};
		editor.change({ ...draft, liabilities: [...draft.liabilities, row] });
	};
	return (
		<>
			<ScenarioHeader
				kind="late-fees"
				name={draft.name}
				onNameChange={(name) => editor.change({ ...draft, name })}
				editor={editor}
			>
				<Button variant="outline" onClick={exportBackup}>
					<FileJsonIcon data-icon="inline-start" />
					导出方案
				</Button>
				<Button onClick={validate}>
					<CalculatorIcon data-icon="inline-start" />
					校验测算
				</Button>
			</ScenarioHeader>
			<ScrollArea
				className="min-h-0 flex-1"
				contentClassName="w-full min-w-0! p-workspace-gutter"
			>
				<div className="flex min-w-0 flex-col gap-4">
					<FieldGroup className="late-fee-plan-fields">
						<Field>
							<FieldLabel htmlFor="late-fee-cutoff">
								测算截止日（含当日）
							</FieldLabel>
							<DatePicker
								id="late-fee-cutoff"
								aria-label="测算截止日"
								disabled={editor.readOnly}
								startMonth={firstDate}
								endMonth={lastDate}
								value={draft.cutoff}
								onValueChange={(cutoff) => editor.change({ ...draft, cutoff })}
							/>
						</Field>
					</FieldGroup>
					<section className="late-fee-totals" aria-label="滞纳金测算汇总">
						<div>
							<p className="text-muted-foreground text-xs">
								税款本金合计（元）
							</p>
							<p className="font-semibold text-xl tabular-nums">
								{money(result.totals?.principal ?? null)}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">未缴本金（元）</p>
							<p className="font-semibold text-xl tabular-nums">
								{money(result.totals?.remaining ?? null)}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">累计滞纳金（元）</p>
							<p className="font-semibold text-warning-foreground text-xl tabular-nums">
								{money(result.totals?.fee ?? null)}
							</p>
						</div>
					</section>
					<p className="text-muted-foreground text-xs">
						{result.totals
							? `已缴本金 ${money(result.totals.paid)} 元；未缴本金＋累计滞纳金 ${money(result.totals.total)} 元（未扣除已缴滞纳金）。`
							: "填写完整后自动更新结果；未完成的资料也会保存。"}
					</p>
					<details className="text-muted-foreground text-sm">
						<summary className="cursor-pointer">
							计算口径：每日万分之五 · 期限次日起算 · 缴款当日计入
						</summary>
						<div className="flex flex-col gap-2 py-3 text-xs">
							<p>
								每段滞纳金＝该段欠税本金×自然日天数×0.05%。分次缴款从次日减少计费本金，已结清本金停止计费；未缴部分算至测算截止日。
							</p>
							<p>
								请填写已确认的最后缴款日，包含节假日顺延或获准延期。税种用于区分税款，本工具不自动推定申报期限，不计算特别纳税调整利息、社保费、罚款或减免。
							</p>
							<p>
								支持2001年5月1日及以后产生的普通税款滞纳金，不计复利、不自动封顶。每笔税款分段精确累加，再四舍五入到分后汇总；显示的是累计发生额，未扣除已缴滞纳金。
							</p>
							<p>
								依据：
								<a
									className="underline"
									href="https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_1dbea81872cb4fda9ab3ccc45c627531.html"
									target="_blank"
									rel="noreferrer"
								>
									税收征管法第三十二条
								</a>
								、
								<a
									className="underline"
									href="https://www.chinatax.gov.cn/chinatax/n810214/c102374/c102377/c102378/c3575330/content.html"
									target="_blank"
									rel="noreferrer"
								>
									实施细则第七十五条
								</a>
								。
							</p>
						</div>
					</details>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="font-semibold text-base">
							税款明细 · {draft.liabilities.length} 笔
						</h2>
						<Button
							variant="outline"
							disabled={
								editor.readOnly || draft.liabilities.length >= MAX_LIABILITIES
							}
							disabledReason={
								editor.readOnly
									? "当前方案不可编辑"
									: `每个方案最多${MAX_LIABILITIES}笔税款`
							}
							onClick={add}
						>
							<PlusIcon data-icon="inline-start" />
							添加税款
						</Button>
					</div>
					{draft.liabilities.map((row, i) => (
						<LateFeeLiability
							readOnly={editor.readOnly}
							key={row.id}
							row={row}
							index={i}
							result={result.rows[i]}
							onChange={(value) =>
								editor.change({
									...draft,
									liabilities: draft.liabilities.map((item) =>
										item.id === row.id ? value : item,
									),
								})
							}
							onRemove={() => setRemoving(row.id)}
						/>
					))}
				</div>
				<Dialog
					open={!!removing}
					onOpenChange={(open) => {
						if (!open) setRemoving(null);
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>删除这笔税款？</DialogTitle>
							<DialogDescription>
								这笔税款及其分次缴款将从当前方案移除。
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => setRemoving(null)}>
								取消
							</Button>
							<Button
								variant="destructive"
								disabled={editor.readOnly}
								onClick={() => {
									editor.change({
										...draft,
										liabilities: draft.liabilities.filter(
											(row) => row.id !== removing,
										),
									});
									setRemoving(null);
								}}
							>
								删除税款
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
