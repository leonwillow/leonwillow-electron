/**
 * @file 增值税所属期的月报/季报选择浮层。
 * 创建时间：2026-11-08；修改时间：2026-11-08。
 * 版本作用：将申报周期、年份及月份/季度一次提交为所属期，不使用日历。
 * 被调用：VatTable 自定义单元格编辑器；调用：领域期间函数、共享 Popover/Select/Field。
 * 预期结果：新行默认月报，确认才提交；取消不改原值，冲突保持浮层供修正。
 */
import {
	periodLabel,
	type ReportingPeriod,
	reportingPeriod,
	reportingPeriodDates,
	reportingPeriodLabel,
} from "@leonwillow-electron/calculators";
import type { EditorContext } from "@leonwillow-electron/lattice-grid";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import {
	Popover,
	PopoverContent,
	PopoverTitle,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { useId, useRef, useState } from "react";
import { type VatGridRow, vatPeriodValue } from "./vat-grid-model";

const years = Array.from({ length: 300 }, (_, index) => String(1900 + index));
const months = Array.from({ length: 12 }, (_, index) => ({
	value: String(index + 1),
	label: `${index + 1}月`,
}));
const quarters = Array.from({ length: 4 }, (_, index) => ({
	value: String(index + 1),
	label: `第${index + 1}季度`,
}));
const cycles = [
	{ value: "monthly", label: "按月申报" },
	{ value: "quarterly", label: "按季申报" },
];

export default function VatPeriodEditor({
	context,
}: {
	context: EditorContext<VatGridRow>;
}) {
	const id = useId();
	const [period, setPeriod] = useState<ReportingPeriod>(() => {
		const existing = reportingPeriod(context.row);
		const today = new Date();
		return (
			existing ?? {
				cycle: "monthly",
				year:
					Number(context.row.periodStart.slice(0, 4)) || today.getFullYear(),
				index:
					Number(context.row.periodStart.slice(5, 7)) || today.getMonth() + 1,
			}
		);
	});
	const committing = useRef(false);
	const [pending, setPending] = useState(false);
	const dates = reportingPeriodDates(period);
	const options = period.cycle === "monthly" ? months : quarters;
	const special =
		(context.row.periodStart || context.row.periodEnd) &&
		!reportingPeriod(context.row);
	const confirm = async () => {
		if (committing.current) return;
		committing.current = true;
		setPending(true);
		const ok = await context.commit(vatPeriodValue(dates));
		if (!ok) {
			committing.current = false;
			setPending(false);
		}
	};
	return (
		<Popover
			open
			onOpenChange={(open, details) => {
				if (!open && !committing.current)
					context.cancel(
						details.reason === "escape-key" ||
							details.reason === "trigger-press",
					);
			}}
		>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="outline"
						className="lg-period-editor"
						data-lg-editor
						aria-label="选择所属期"
					/>
				}
			>
				{reportingPeriodLabel(context.row)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="vat-period-picker"
				data-lg-edit-scope={context.editScope}
				finalFocus={false}
			>
				<PopoverTitle>选择所属期</PopoverTitle>
				<FieldGroup className="vat-period-fields">
					<Field>
						<FieldLabel htmlFor={`${id}-cycle`}>申报周期</FieldLabel>
						<Select
							value={period.cycle}
							items={cycles}
							disabled={pending}
							onValueChange={(cycle) => {
								if (
									(cycle !== "monthly" && cycle !== "quarterly") ||
									cycle === period.cycle
								)
									return;
								setPeriod({
									...period,
									cycle,
									index:
										cycle === "quarterly"
											? Math.ceil(period.index / 3)
											: (period.index - 1) * 3 + 1,
								});
							}}
						>
							<SelectTrigger id={`${id}-cycle`} aria-label="申报周期">
								<SelectValue />
							</SelectTrigger>
							<SelectContent data-lg-edit-scope={context.editScope}>
								<SelectGroup>
									{cycles.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-year`}>年份</FieldLabel>
						<Select
							value={String(period.year)}
							disabled={pending}
							onValueChange={(year) => {
								if (year) setPeriod({ ...period, year: Number(year) });
							}}
						>
							<SelectTrigger id={`${id}-year`} aria-label="所属期年份">
								<SelectValue>{period.year}年</SelectValue>
							</SelectTrigger>
							<SelectContent data-lg-edit-scope={context.editScope}>
								<SelectGroup>
									{years.map((year) => (
										<SelectItem key={year} value={year}>
											{year}年
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-index`}>
							{period.cycle === "monthly" ? "月份" : "季度"}
						</FieldLabel>
						<Select
							value={String(period.index)}
							items={options}
							disabled={pending}
							onValueChange={(index) => {
								if (index) setPeriod({ ...period, index: Number(index) });
							}}
						>
							<SelectTrigger
								id={`${id}-index`}
								aria-label={
									period.cycle === "monthly" ? "所属期月份" : "所属期季度"
								}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent data-lg-edit-scope={context.editScope}>
								<SelectGroup>
									{options.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				</FieldGroup>
				<p className="text-muted-foreground" aria-live="polite">
					{periodLabel(dates)}
				</p>
				{special && (
					<p className="text-muted-foreground">
						原所属期：{periodLabel(context.row)}。确定后替换为所选月或季度。
					</p>
				)}
				<div className="flex justify-end gap-2">
					<Button
						variant="ghost"
						disabled={pending}
						onClick={() => context.cancel()}
					>
						取消
					</Button>
					<Button disabled={pending} onClick={() => void confirm()}>
						确定
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
