/**
 * @file 共享尺寸的文本输入的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-05
 * 版本作用：共享表单输入与继承单元格排版的无内框编辑变体。
 * 被调用：components、components/theme-editor、views/register、views/login。
 * 调用：@base-ui/react、ui/lib/utils、react。
 * 功能：组合底层控件和语义样式，透传对应属性并提供稳定 data-slot。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import type * as React from "react";

const inputSizes = {
	sm: "h-control-sm",
	default: "h-control-md",
	lg: "h-control-lg",
} as const;

function Input({
	className,
	type,
	size = "default",
	variant = "default",
	htmlSize,
	...props
}: Omit<React.ComponentProps<"input">, "size"> & {
	size?: keyof typeof inputSizes;
	variant?: "default" | "cell";
	htmlSize?: number;
}) {
	return (
		<InputPrimitive
			type={type}
			size={htmlSize}
			data-slot="input"
			data-size={size}
			data-variant={variant}
			className={cn(
				variant === "cell"
					? "cell-control disabled:cursor-not-allowed disabled:opacity-50"
					: [
							"w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-control/relaxed outline-none transition-colors file:inline-flex file:h-control-sm file:border-0 file:bg-transparent file:font-medium file:text-control/relaxed file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
							inputSizes[size],
						],
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
