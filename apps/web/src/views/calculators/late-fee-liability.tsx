/**
 * @file 单笔税款、分次缴纳及计费明细表单。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 版本作用：稳定标识保持编辑焦点，使用共享日期选择与 ScrollArea 表格。
 * 被调用：LateFeeEditor；调用：领域类型、共享表单及卡片组件。
 * 预期结果：录入本金与确认期限，分段结果可核对；校验说明仅在 Sonner 弹出。
 */

import { money } from "@leonwillow-electron/calculators";
import {
	type LateFeeResult,
	MAX_PAYMENTS,
	type TaxLiability,
	taxTypes,
} from "@leonwillow-electron/calculators/late-fees";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import { DatePicker } from "@leonwillow-electron/ui/components/date-picker";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { randomUUID } from "@/lib/uuid";
export const firstDate = new Date(2001, 3, 30);
export const lastDate = new Date(2199, 11, 31);
export default function LateFeeLiability({
	row,
	index,
	result,
	onChange,
	onRemove,
	readOnly = false,
}: {
	row: TaxLiability;
	index: number;
	result: LateFeeResult["rows"][number] | undefined;
	onChange: (value: TaxLiability) => void;
	onRemove: () => void;
	readOnly?: boolean;
}) {
	const patch = (value: Partial<TaxLiability>) =>
		onChange({ ...row, ...value });
	const r = result?.result;
	return (
		<Card role="region" aria-label={`第${index + 1}笔税款`}>
			<CardHeader>
				<CardTitle>
					第 {index + 1} 笔 · {taxTypes[row.taxType]}
				</CardTitle>
				<CardDescription>
					{row.period || "填写所属期、税款本金与确认缴款期限"}
				</CardDescription>
				<CardAction>
					<Tooltip disableHoverablePopup>
						<TooltipTrigger
							render={
								<Button
									variant="destructive"
									disabled={readOnly}
									disabledReason="当前方案不可编辑"
									size="icon-sm"
									aria-label={`删除第${index + 1}笔税款`}
									onClick={onRemove}
								/>
							}
						>
							<Trash2Icon />
						</TooltipTrigger>
						<TooltipContent>删除这笔税款</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent className="flex min-w-0 flex-col gap-4">
				<FieldGroup className="late-fee-fields">
					<Field>
						<FieldLabel htmlFor={`${row.id}-tax`}>税种</FieldLabel>
						<Select
							disabled={readOnly}
							value={row.taxType}
							onValueChange={(value) => {
								if (value) patch({ taxType: value });
							}}
						>
							<SelectTrigger id={`${row.id}-tax`} className="w-full">
								<SelectValue>{taxTypes[row.taxType]}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{Object.entries(taxTypes).map(([key, label]) => (
										<SelectItem key={key} value={key}>
											{label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${row.id}-period`}>税款所属期</FieldLabel>
						<Input
							readOnly={readOnly}
							id={`${row.id}-period`}
							value={row.period}
							maxLength={80}
							placeholder="例如：2025年度 / 2026年1月"
							onChange={(e) => patch({ period: e.target.value })}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${row.id}-principal`}>
							税款本金（元）
						</FieldLabel>
						<Input
							readOnly={readOnly}
							id={`${row.id}-principal`}
							inputMode="decimal"
							value={row.principal}
							maxLength={100}
							placeholder="0.00"
							onChange={(e) => patch({ principal: e.target.value })}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${row.id}-deadline`}>确认缴款期限</FieldLabel>
						<DatePicker
							disabled={readOnly}
							id={`${row.id}-deadline`}
							aria-label={`第${index + 1}笔确认缴款期限`}
							startMonth={firstDate}
							endMonth={lastDate}
							value={row.deadline}
							onValueChange={(deadline) => patch({ deadline })}
						/>
					</Field>
					<Field className="late-fee-note">
						<FieldLabel htmlFor={`${row.id}-note`}>备注</FieldLabel>
						<Input
							readOnly={readOnly}
							id={`${row.id}-note`}
							value={row.note}
							maxLength={300}
							placeholder="可填写税票、核定依据或期限说明"
							onChange={(e) => patch({ note: e.target.value })}
						/>
					</Field>
				</FieldGroup>
				<section
					aria-label={`第${index + 1}笔分次缴款`}
					className="flex flex-col gap-3"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="font-medium text-sm">已缴本金</h3>
						<Button
							variant="ghost"
							size="sm"
							disabled={readOnly || row.payments.length >= MAX_PAYMENTS}
							disabledReason={
								readOnly
									? "当前方案不可编辑"
									: `每笔税款最多${MAX_PAYMENTS}次缴款`
							}
							onClick={() =>
								patch({
									payments: [
										...row.payments,
										{ id: randomUUID(), date: "", amount: "" },
									],
								})
							}
						>
							<PlusIcon data-icon="inline-start" />
							添加缴款
						</Button>
					</div>
					{row.payments.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							尚未缴纳时无需添加；剩余本金计至测算截止日。这里只录入税款本金，不含已缴滞纳金。
						</p>
					) : (
						row.payments.map((p, pi) => (
							<FieldGroup key={p.id} className="late-fee-payment">
								<Field>
									<FieldLabel htmlFor={`${p.id}-date`}>
										第 {pi + 1} 次缴款日期
									</FieldLabel>
									<DatePicker
										disabled={readOnly}
										id={`${p.id}-date`}
										aria-label={`第${index + 1}笔第${pi + 1}次缴款日期`}
										startMonth={firstDate}
										endMonth={lastDate}
										value={p.date}
										onValueChange={(date) =>
											patch({
												payments: row.payments.map((item) =>
													item.id === p.id ? { ...item, date } : item,
												),
											})
										}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor={`${p.id}-amount`}>
										缴款本金（元）
									</FieldLabel>
									<Input
										readOnly={readOnly}
										id={`${p.id}-amount`}
										inputMode="decimal"
										maxLength={100}
										value={p.amount}
										placeholder="0.00"
										onChange={(e) =>
											patch({
												payments: row.payments.map((item) =>
													item.id === p.id
														? { ...item, amount: e.target.value }
														: item,
												),
											})
										}
									/>
								</Field>
								<Tooltip disableHoverablePopup>
									<TooltipTrigger
										render={
											<Button
												variant="destructive"
												disabled={readOnly}
												disabledReason="当前方案不可编辑"
												size="icon-sm"
												aria-label={`删除第${index + 1}笔第${pi + 1}次缴款`}
												onClick={() =>
													patch({
														payments: row.payments.filter(
															(item) => item.id !== p.id,
														),
													})
												}
											/>
										}
									>
										<Trash2Icon />
									</TooltipTrigger>
									<TooltipContent>删除这次缴款</TooltipContent>
								</Tooltip>
							</FieldGroup>
						))
					)}
				</section>
				{r && (
					<details className="flex min-w-0 flex-col">
						<summary className="cursor-pointer text-sm">
							计费明细 · {r.days} 天 · {r.segments.length} 段
						</summary>
						{r.segments.length ? (
							<Table className="late-fee-table">
								<TableHeader>
									<TableRow>
										<TableHead>计费起止日（含）</TableHead>
										<TableHead>天数</TableHead>
										<TableHead>欠税本金（元）</TableHead>
										<TableHead>滞纳金（元，未舍入）</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{r.segments.map((s) => (
										<TableRow key={s.start}>
											<TableCell>
												{s.start} 至 {s.end}
											</TableCell>
											<TableCell>{s.days}</TableCell>
											<TableCell>{money(s.balance)}</TableCell>
											<TableCell>{s.feeExact}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<p className="py-3 text-muted-foreground text-xs">
								截至测算日未产生滞纳天数。
							</p>
						)}
					</details>
				)}
			</CardContent>
			<CardFooter className="flex flex-wrap justify-between gap-3 border-t">
				{r ? (
					<>
						<span>
							未缴本金{" "}
							<strong className="tabular-nums">{money(r.remaining)}</strong> 元
						</span>
						<span>
							累计滞纳金{" "}
							<strong className="text-warning-foreground tabular-nums">
								{money(r.fee)}
							</strong>{" "}
							元
						</span>
					</>
				) : (
					<>
						<span className="text-muted-foreground">
							资料待完善 · 暂不计入合计
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								toast.error(`第${index + 1}笔税款暂无法计算`, {
									description: result?.error ?? "请填写税款资料",
								})
							}
						>
							查看原因
						</Button>
					</>
				)}
			</CardFooter>
		</Card>
	);
}
