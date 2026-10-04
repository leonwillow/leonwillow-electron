/**
 * @file 关联表单控件的标签的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/field.tsx、components/layout/theme-customizer.tsx、components/theme-editor/theme-control-panel.tsx。
 * 调用：ui/lib/utils、react。
 * 功能：组合底层控件和语义样式，透传对应属性并提供稳定 data-slot。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import type * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor、children 由调用方传入。
		<label
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-medium text-control/relaxed leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
