/**
 * @file 滞纳金方案的录入、汇总、规则说明与保存工作区。
 * 创建时间：2026-11-05；修改时间：2026-11-21。
 * 版本作用：按单笔税款粒度增量缓存计费结果并提供稳定回调，配合 memo 子卡片消除输入卡顿。
 * 被调用：LateFeesView；调用：LateFeeLiability、useScenario、共享控件与 Eden。
 * 预期结果：多税种、多次缴款可持久化，修改方案名或单笔税款不重算、不重渲染无关税款。
 */

import { exact, money } from "@leonwillow-electron/calculators";
import {
	calculateLiability,
	dayNumber,
	LATE_FEE_RULES,
	type LateFeeResult,
	MAX_LIABILITIES,
	type TaxLiability,
} from "@leonwillow-electron/calculators/late-fees";
import { Button } from "@leonwillow-electron/ui/components/button";
import { ConfirmDialog } from "@leonwillow-electron/ui/components/confirm-dialog";
import { DatePicker } from "@leonwillow-electron/ui/components/date-picker";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { CalculatorIcon, FileJsonIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { downloadCalculation } from "@/lib/calculators";
import { type LateFeeScenario, saveLateFee } from "@/lib/late-fees";
import { randomUUID } from "@/lib/uuid";
import LateFeeLiability, { firstDate, lastDate } from "./late-fee-liability";
import ScenarioHeader from "./scenario-header";
import { useScenario } from "./use-scenario";

type CachedLiabilityRow = {
	cutoff: string;
	entry: LateFeeResult["rows"][number];
};

function computeIncrementalLateFees(
	cutoff: string,
	liabilities: readonly TaxLiability[],
	cache: WeakMap<TaxLiability, CachedLiabilityRow>,
): LateFeeResult {
	let error: string | null = null;
	try {
		try {
			dayNumber(cutoff);
		} catch (cause) {
			throw Error(
				`测算截止日：${cause instanceof Error ? cause.message : "日期无效"}`,
			);
		}
		if (!liabilities.length) throw Error("请添加至少一笔税款");
		if (liabilities.length > MAX_LIABILITIES)
			throw Error(`最多支持${MAX_LIABILITIES}笔税款`);
		if (new Set(liabilities.map((r) => r.id)).size !== liabilities.length)
			throw Error("税款标识重复");
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "测算数据无效";
	}
	const rows = liabilities.map((row) => {
		const hit = cache.get(row);
		if (hit && hit.cutoff === cutoff) return hit.entry;
		let entry: LateFeeResult["rows"][number];
		try {
			if (new Set(row.payments.map((p) => p.id)).size !== row.payments.length)
				throw Error("缴款标识重复");
			entry = {
				id: row.id,
				result: calculateLiability(row, cutoff),
				error: null,
			};
		} catch (cause) {
			entry = {
				id: row.id,
				result: null,
				error: cause instanceof Error ? cause.message : "税款数据无效",
			};
		}
		cache.set(row, { cutoff, entry });
		return entry;
	});
	let totals: LateFeeResult["totals"] = null;
	if (!error && rows.every((row) => row.result)) {
		try {
			const sum = { principal: 0, paid: 0, remaining: 0, fee: 0, total: 0 };
			for (const row of rows) {
				const r = row.result;
				if (!r) continue;
				sum.principal = exact(sum.principal + r.principal);
				sum.paid = exact(sum.paid + r.paid);
				sum.remaining = exact(sum.remaining + r.remaining);
				sum.fee = exact(sum.fee + r.fee);
				sum.total = exact(sum.total + r.total);
			}
			totals = sum;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "累计金额超出可计算范围";
		}
	}
	return { rows, totals, error };
}

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
	const { draft, change: setDraft } = editor;
	const rowCache = useRef(new WeakMap<TaxLiability, CachedLiabilityRow>());
	const result = useMemo(
		() =>
			computeIncrementalLateFees(
				draft.cutoff,
				draft.liabilities,
				rowCache.current,
			),
		[draft.cutoff, draft.liabilities],
	);
	const [removing, setRemoving] = useState<string | null>(null);

	const handleNameChange = useCallback(
		(name: string) => setDraft((prev) => ({ ...prev, name })),
		[setDraft],
	);
	const handleCutoffChange = useCallback(
		(cutoff: string) => setDraft((prev) => ({ ...prev, cutoff })),
		[setDraft],
	);
	const handleLiabilityChange = useCallback(
		(id: string, value: TaxLiability) =>
			setDraft((prev) => ({
				...prev,
				liabilities: prev.liabilities.map((item) =>
					item.id === id ? value : item,
				),
			})),
		[setDraft],
	);
	const handleLiabilityRemove = useCallback(
		(id: string) => setRemoving(id),
		[],
	);

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
			id: randomUUID(),
			taxType: "vat",
			period: "",
			principal: "",
			deadline: "",
			note: "",
			payments: [],
		};
		setDraft((prev) => ({ ...prev, liabilities: [...prev.liabilities, row] }));
	};
	return (
		<>
			<ScenarioHeader
				kind="late-fees"
				name={draft.name}
				onNameChange={handleNameChange}
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
				<div className="flex min-w-0 flex-col gap-workspace-gutter">
					<FieldGroup className="grid min-w-[min(100%,18rem)] flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
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
								onValueChange={handleCutoffChange}
							/>
						</Field>
					</FieldGroup>
					<section
						className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4 rounded-lg bg-muted p-4"
						aria-label="滞纳金测算汇总"
					>
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
									rel="noopener noreferrer"
								>
									税收征管法第三十二条
								</a>
								、
								<a
									className="underline"
									href="https://www.chinatax.gov.cn/chinatax/n810214/c102374/c102377/c102378/c3575330/content.html"
									target="_blank"
									rel="noopener noreferrer"
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
							onChange={handleLiabilityChange}
							onRemove={handleLiabilityRemove}
						/>
					))}
				</div>
				<ConfirmDialog
					open={!!removing}
					title="删除这笔税款？"
					confirmLabel="删除税款"
					showCloseButton
					disabled={editor.readOnly}
					onClose={() => setRemoving(null)}
					onConfirm={() => {
						setDraft((prev) => ({
							...prev,
							liabilities: prev.liabilities.filter(
								(row) => row.id !== removing,
							),
						}));
						setRemoving(null);
					}}
				>
					这笔税款及其分次缴款将从当前方案移除。
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
