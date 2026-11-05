/**
 * @file 按钮外观、尺寸变体与自定义触发器的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-05
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：packages/ui/test、components、components/auth、components/layout、components/theme-editor、views/register、views/login。
 * 调用：@base-ui/react、ui/lib/utils、class-variance-authority。
 * 功能：组合底层控件和语义样式；禁用保留鼠标反馈，可提供原因提示且阻止操作。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-clip-padding font-medium text-control/relaxed outline-none transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-disabled:not-aria-disabled:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:not-disabled:not-aria-disabled:bg-primary/80",
				outline:
					"border-border hover:not-disabled:not-aria-disabled:bg-input/50 hover:not-disabled:not-aria-disabled:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30",
				secondary:
					"bg-secondary text-secondary-foreground hover:not-disabled:not-aria-disabled:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
				ghost:
					"hover:not-disabled:not-aria-disabled:bg-muted hover:not-disabled:not-aria-disabled:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:not-disabled:not-aria-disabled:bg-muted/50",
				info: "bg-transparent text-info hover:not-disabled:not-aria-disabled:bg-info/10 focus-visible:border-info/40 focus-visible:ring-info/20",
				success:
					"bg-transparent text-success hover:not-disabled:not-aria-disabled:bg-success/10 focus-visible:border-success/40 focus-visible:ring-success/20",
				warning:
					"bg-transparent text-warning hover:not-disabled:not-aria-disabled:bg-warning/10 focus-visible:border-warning/40 focus-visible:ring-warning/20",
				destructive:
					"bg-transparent text-destructive hover:not-disabled:not-aria-disabled:bg-destructive/10 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
				link: "text-primary underline-offset-4 hover:not-disabled:not-aria-disabled:underline",
			},
			size: {
				default:
					"h-control-md gap-1 px-3 text-control/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				xs: "h-control-xs gap-1 rounded-sm px-2 text-caption has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-2.5",
				sm: "h-control-sm gap-1 px-2 text-control/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				lg: "h-control-lg gap-1 px-4 text-control/relaxed has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
				icon: "size-control-md [&_svg:not([class*='size-'])]:size-3.5",
				"icon-xs":
					"size-control-xs rounded-sm [&_svg:not([class*='size-'])]:size-2.5",
				"icon-sm": "size-control-sm [&_svg:not([class*='size-'])]:size-3",
				"icon-lg": "size-control-lg [&_svg:not([class*='size-'])]:size-4",
				"icon-workspace":
					"size-workspace-icon [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	disabledReason,
	disabled,
	focusableWhenDisabled = !!disabledReason,
	onClickCapture,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & {
		disabledReason?: string;
	}) {
	const button = (
		<ButtonPrimitive
			data-slot="button"
			disabled={disabled}
			focusableWhenDisabled={focusableWhenDisabled}
			onClickCapture={(event) => {
				// 可聚焦的禁用按钮仍须阻止父行导航/表单提交。
				if (disabled) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				onClickCapture?.(event);
			}}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
	if (!disabledReason) return button;
	return (
		<Tooltip disabled={!disabled}>
			<TooltipTrigger render={button} />
			<TooltipContent>{disabledReason}</TooltipContent>
		</Tooltip>
	);
}

export { Button, buttonVariants };
