/**
 * @file 业务工作区共用的标题栏、模块标题和二级面包屑。
 * 创建时间：2026-11-05；修改时间：2026-11-20。
 * 版本作用：以笔录顶栏统一高度、留白、字重及图标，业务保留自己的工具和路径。
 * 被调用：笔录、计算器、文书、人员管理及资金视图；调用：共享主题令牌、TooltipText 和 Lucide 图标。
 * 预期结果：各模块标题和二级路径样式基线一致，窄窗口允许工具换行，跟随全局主题和缩放。
 */
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function WorkspaceHeader({
	className,
	...props
}: ComponentProps<"header">) {
	return (
		<header
			data-slot="workspace-header"
			className={cn(
				"flex min-h-workspace-header shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-workspace-gutter py-2",
				className,
			)}
			{...props}
		/>
	);
}

export function WorkspaceTitle({
	icon: Icon,
	children,
}: {
	icon: LucideIcon;
	children: ReactNode;
}) {
	return (
		<h1
			data-slot="workspace-title"
			className="flex shrink-0 items-center gap-2 font-semibold text-base text-foreground"
		>
			<Icon aria-hidden="true" className="size-4 shrink-0" />
			{children}
		</h1>
	);
}

export function WorkspaceBreadcrumb({ label }: { label: string }) {
	return (
		<>
			<ChevronRightIcon
				aria-hidden="true"
				className="size-4 shrink-0 text-muted-foreground"
			/>
			<TooltipText content={label}>
				<span className="min-w-0 truncate text-muted-foreground text-sm">
					{label}
				</span>
			</TooltipText>
		</>
	);
}
