/**
 * @file shadcn Calendar 的共享日历与日期按钮。
 * 创建时间：2026-11-04；修改时间：2026-11-06。
 * 版本作用：沿用 base-mira 官方 DayPicker 组合，适配中文名称及共享控件令牌。
 * 被调用：DatePicker；调用：React DayPicker、date-fns、共享 Button。
 * 预期结果：支持年月下拉、单日或范围选择与键盘导航，尺寸随全局 rem 缩放。
 */

import {
	Button,
	buttonVariants,
} from "@leonwillow-electron/ui/components/button";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { format } from "date-fns";
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "lucide-react";
import * as React from "react";
import {
	type DayButton,
	DayPicker,
	type DropdownProps,
	getDefaultClassNames,
	type Locale,
} from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

// 年月下拉通过 Portal 展示时，仍属于调用方的单元格编辑会话。
const CalendarEditScope = React.createContext<string | undefined>(undefined);

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = "label",
	buttonVariant = "ghost",
	locale = zhCN,
	labels,
	formatters,
	components,
	editScope,
	...props
}: React.ComponentProps<typeof DayPicker> & {
	buttonVariant?: React.ComponentProps<typeof Button>["variant"];
	editScope?: string;
}) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<CalendarEditScope value={editScope}>
			<DayPicker
				showOutsideDays={showOutsideDays}
				className={cn(
					"group/calendar bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent p-3 text-control [--cell-radius:var(--radius-md)] [--cell-size:var(--spacing-control-md)]",
					String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
					String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
					className,
				)}
				captionLayout={captionLayout}
				locale={locale}
				labels={{
					labelPrevious: () => "上个月",
					labelNext: () => "下个月",
					labelMonthDropdown: () => "选择月份",
					labelYearDropdown: () => "选择年份",
					labelDayButton: (date, modifiers) =>
						`${format(date, "yyyy年M月d日 EEEE", { locale: zhCN })}${modifiers.today ? "，今天" : ""}${modifiers.selected ? "，已选择" : ""}`,
					...labels,
				}}
				formatters={{
					formatMonthDropdown: (date) =>
						date.toLocaleString(locale?.code, { month: "short" }),
					...formatters,
				}}
				classNames={{
					root: cn("w-fit", defaultClassNames.root),
					months: cn(
						"relative flex flex-col gap-4 md:flex-row",
						defaultClassNames.months,
					),
					month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
					nav: cn(
						"pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
						defaultClassNames.nav,
					),
					button_previous: cn(
						buttonVariants({ variant: buttonVariant }),
						"pointer-events-auto size-(--cell-size) select-none p-0 aria-disabled:opacity-50",
						defaultClassNames.button_previous,
					),
					button_next: cn(
						buttonVariants({ variant: buttonVariant }),
						"pointer-events-auto size-(--cell-size) select-none p-0 aria-disabled:opacity-50",
						defaultClassNames.button_next,
					),
					month_caption: cn(
						"flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
						defaultClassNames.month_caption,
					),
					dropdowns: cn(
						"flex h-(--cell-size) w-full items-center justify-center gap-1.5 font-medium text-control",
						defaultClassNames.dropdowns,
					),
					dropdown_root: cn(
						"cn-calendar-dropdown-root relative rounded-(--cell-radius)",
						defaultClassNames.dropdown_root,
					),
					dropdown: cn(
						"absolute inset-0 bg-popover opacity-0",
						defaultClassNames.dropdown,
					),
					caption_label: cn(
						"select-none font-medium",
						captionLayout === "label"
							? "cn-calendar-caption text-control"
							: "cn-calendar-caption-label flex items-center gap-1 rounded-(--cell-radius) text-control [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
						defaultClassNames.caption_label,
					),
					month_grid: cn(
						"w-full border-collapse",
						defaultClassNames.month_grid,
					),
					weekdays: cn("flex", defaultClassNames.weekdays),
					weekday: cn(
						"flex-1 select-none rounded-(--cell-radius) font-normal text-control text-muted-foreground",
						defaultClassNames.weekday,
					),
					week: cn("mt-2 flex w-full", defaultClassNames.week),
					week_number_header: cn(
						"w-(--cell-size) select-none",
						defaultClassNames.week_number_header,
					),
					week_number: cn(
						"select-none text-control text-muted-foreground",
						defaultClassNames.week_number,
					),
					day: cn(
						"group/day relative aspect-square h-full w-full select-none rounded-(--cell-radius) p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
						props.showWeekNumber
							? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
							: "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
						defaultClassNames.day,
					),
					range_start: cn(
						"relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
						defaultClassNames.range_start,
					),
					range_middle: cn("rounded-none", defaultClassNames.range_middle),
					range_end: cn(
						"relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
						defaultClassNames.range_end,
					),
					today: cn(
						"rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none",
						defaultClassNames.today,
					),
					outside: cn(
						"text-muted-foreground aria-selected:text-muted-foreground",
						defaultClassNames.outside,
					),
					disabled: cn(
						"text-muted-foreground opacity-50",
						defaultClassNames.disabled,
					),
					hidden: cn("invisible", defaultClassNames.hidden),
					...classNames,
				}}
				components={{
					Dropdown: CalendarDropdown,
					Root: ({ className, rootRef, ...props }) => {
						return (
							<div
								data-slot="calendar"
								ref={rootRef}
								className={cn(className)}
								{...props}
							/>
						);
					},
					Chevron: ({ className, orientation, ...props }) => {
						if (orientation === "left") {
							return (
								<ChevronLeftIcon
									className={cn("cn-rtl-flip size-4", className)}
									{...props}
								/>
							);
						}

						if (orientation === "right") {
							return (
								<ChevronRightIcon
									className={cn("cn-rtl-flip size-4", className)}
									{...props}
								/>
							);
						}

						return (
							<ChevronDownIcon className={cn("size-4", className)} {...props} />
						);
					},
					DayButton: ({ ...props }) => (
						<CalendarDayButton locale={locale} {...props} />
					),
					WeekNumber: ({ children, ...props }) => {
						return (
							<td {...props}>
								<div className="flex size-(--cell-size) items-center justify-center text-center">
									{children}
								</div>
							</td>
						);
					},
					...components,
				}}
				{...props}
			/>
		</CalendarEditScope>
	);
}

/** DayPicker 官方 Dropdown 适配：保留月份范围、禁用选项及原 onChange 导航。 */
function CalendarDropdown({
	options = [],
	value,
	onChange,
	disabled,
	id,
	name,
	tabIndex,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
}: DropdownProps) {
	const editScope = React.useContext(CalendarEditScope);
	const items = options.map((option) => ({
		...option,
		value: String(option.value),
	}));
	return (
		<Select
			items={items}
			value={value?.toString() ?? null}
			disabled={disabled}
			name={name}
			onValueChange={(next) => {
				if (next !== null)
					onChange?.({
						target: { value: next },
					} as React.ChangeEvent<HTMLSelectElement>);
			}}
		>
			<SelectTrigger
				id={id}
				tabIndex={tabIndex}
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent data-lg-edit-scope={editScope}>
				<SelectGroup>
					{items.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							disabled={option.disabled}
						>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

function CalendarDayButton({
	className,
	day,
	modifiers,
	locale,
	...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
	const defaultClassNames = getDefaultClassNames();

	const ref = React.useRef<HTMLButtonElement>(null);
	React.useEffect(() => {
		if (modifiers.focused) ref.current?.focus();
	}, [modifiers.focused]);

	return (
		<Button
			ref={ref}
			variant="ghost"
			size="icon"
			data-day={day.date.toLocaleDateString(locale?.code)}
			data-selected-single={
				modifiers.selected &&
				!modifiers.range_start &&
				!modifiers.range_end &&
				!modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			className={cn(
				"relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 font-normal leading-none data-[range-end=true]:rounded-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-end=true]:bg-primary data-[range-middle=true]:bg-muted data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 [&>span]:text-caption [&>span]:opacity-70",
				defaultClassNames.day,
				className,
			)}
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };
