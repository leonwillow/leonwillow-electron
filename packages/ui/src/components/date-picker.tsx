/**
 * @file 带年月下拉的中文单日选择控件。
 * 创建时间：2026-11-04；修改时间：2026-11-06。
 * 版本作用：组合 shadcn 官方 Date of Birth 示例的 Popover 与 Calendar。
 * 被调用：笔录基础信息、计算器所属期单元格；调用：共享 Button、Calendar、Popover、date-fns。
 * 预期结果：以本地日历日期读写 yyyy-MM-dd，选择后关闭并回到触发器，不产生时区偏移。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Calendar } from "@leonwillow-electron/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { format, isValid, parse } from "date-fns";
import { type ComponentProps, useState } from "react";

type DatePickerProps = Omit<
	ComponentProps<typeof Button>,
	"value" | "onChange" | "children"
> & {
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	startMonth?: Date;
	endMonth?: Date;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	editScope?: string;
	displayFormat?: string;
	defaultMonth?: Date;
};

/** 无效日期只显示占位，不回写或自动修正调用方数据。 */
function parseLocalDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const date = parse(value, "yyyy-MM-dd", new Date());
	return isValid(date) && format(date, "yyyy-MM-dd") === value
		? date
		: undefined;
}

function DatePicker({
	value,
	onValueChange,
	placeholder = "选择日期",
	startMonth,
	endMonth,
	className,
	defaultOpen = false,
	onOpenChange,
	editScope,
	displayFormat = "yyyy年M月d日",
	defaultMonth,
	disabled,
	...props
}: DatePickerProps) {
	const [open, setOpen] = useState(defaultOpen);
	const changeOpen = (next: boolean) => {
		setOpen(next);
		onOpenChange?.(next);
	};
	const date = parseLocalDate(value);
	const selectedYear = date?.getFullYear() ?? new Date().getFullYear();
	// 业务日期支持过去和未来；历史已存日期也必须在下拉导航范围内。
	const firstMonth = startMonth ?? new Date(Math.min(1900, selectedYear), 0);
	const lastMonth =
		endMonth ??
		new Date(Math.max(new Date().getFullYear() + 100, selectedYear), 11);
	return (
		<Popover open={open && !disabled} onOpenChange={changeOpen}>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="outline"
						disabled={disabled}
						aria-label="选择日期"
						data-empty={!date}
						className={cn(
							"w-full min-w-0 justify-start font-normal data-[empty=true]:text-muted-foreground",
							className,
						)}
						{...props}
					/>
				}
			>
				{date ? format(date, displayFormat) : placeholder}
			</PopoverTrigger>
			<PopoverContent
				data-lg-edit-scope={editScope}
				className="w-auto overflow-hidden p-0"
				align="start"
				aria-label={props["aria-label"] || "选择日期"}
			>
				<Calendar
					editScope={editScope}
					mode="single"
					required
					autoFocus
					selected={date}
					defaultMonth={date ?? defaultMonth}
					captionLayout="dropdown"
					startMonth={firstMonth}
					endMonth={lastMonth}
					onSelect={(next) => {
						onValueChange(format(next, "yyyy-MM-dd"));
						changeOpen(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

export { DatePicker, type DatePickerProps };
