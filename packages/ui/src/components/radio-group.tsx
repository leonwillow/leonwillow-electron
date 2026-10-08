/**
 * @file 普通及分段外观的单选组的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-08
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/layout/theme-customizer.tsx、components/theme-editor/theme-control-panel.tsx、views/funds/analysis-panel.tsx。
 * 调用：@base-ui/react、ui/lib/utils。
 * 功能：组合底层控件和语义样式，透传对应属性并提供稳定 data-slot。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@leonwillow-electron/ui/lib/utils";

function RadioGroup({
	className,
	variant = "default",
	size = "default",
	...props
}: RadioGroupPrimitive.Props & {
	variant?: "default" | "segmented" | "tabs";
	size?: "sm" | "default" | "lg";
}) {
	return (
		<RadioGroupPrimitive
			data-slot="radio-group"
			data-variant={variant}
			data-size={size}
			className={cn(
				"grid w-full gap-3",
				// 分段项由外层 Label 提供边框和选中背景，此处只管理尺寸与焦点。
				variant === "segmented" &&
					"gap-0 rounded-md data-[size=default]:h-control-md data-[size=lg]:h-control-lg data-[size=sm]:h-control-sm [&>label]:font-normal [&>label]:text-control/relaxed [&>label]:has-focus-visible:border-ring [&>label]:has-focus-visible:ring-3 [&>label]:has-focus-visible:ring-ring/50 [&>label_svg]:size-3.5 [&>label_svg]:shrink-0",
				// 与默认 Tabs 同一外观，保留 Label > Radio 的表单语义及方向键行为。
				variant === "tabs" && [
					"inline-flex h-8 w-fit items-center justify-center gap-0 rounded-lg bg-muted p-0.5 text-muted-foreground",
					"[&>label]:relative [&>label]:h-[calc(100%-1px)] [&>label]:flex-1 [&>label]:cursor-pointer [&>label]:justify-center [&>label]:gap-1.5 [&>label]:whitespace-nowrap [&>label]:rounded-md [&>label]:border [&>label]:border-transparent [&>label]:px-1.5 [&>label]:py-0.5 [&>label]:font-medium [&>label]:text-foreground/60 [&>label]:text-xs/4 [&>label]:transition-colors [&>label]:hover:text-foreground dark:[&>label]:text-muted-foreground dark:[&>label]:hover:text-foreground",
					"[&>label]:has-data-checked:bg-background [&>label]:has-data-checked:text-foreground dark:[&>label]:has-data-checked:border-input dark:[&>label]:has-data-checked:bg-input/30 dark:[&>label]:has-data-checked:text-foreground",
					"[&>label]:has-data-disabled:pointer-events-none [&>label]:has-focus-visible:border-ring [&>label]:has-data-disabled:opacity-50 [&>label]:has-focus-visible:outline-1 [&>label]:has-focus-visible:outline-ring [&>label]:has-focus-visible:ring-3 [&>label]:has-focus-visible:ring-ring/50",
				],
				className,
			)}
			{...props}
		/>
	);
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
	return (
		<RadioPrimitive.Root
			data-slot="radio-group-item"
			className={cn(
				"group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:bg-input/30 dark:data-checked:bg-primary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		>
			<RadioPrimitive.Indicator
				data-slot="radio-group-indicator"
				className="flex size-4 items-center justify-center"
			>
				<span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
			</RadioPrimitive.Indicator>
		</RadioPrimitive.Root>
	);
}

export { RadioGroup, RadioGroupItem };
