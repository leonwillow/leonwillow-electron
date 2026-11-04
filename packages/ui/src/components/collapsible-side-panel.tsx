/**
 * @file 在侧面板边缘居中提供折叠与展开手柄。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：复用 Base UI 折叠语义，呈现竖条到方向箭头的交互反馈。
 * 被调用：InquiryRecordEditor；调用：共享 Collapsible、cn 和全局面板样式。
 * 预期结果：面板收起后让出正文空间，边缘手柄始终可用，键盘可展开/收起。
 */
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@leonwillow-electron/ui/components/collapsible";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import type { ReactNode } from "react";

function CollapsibleSidePanel({
	title,
	label,
	side,
	open,
	onOpenChange,
	className,
	children,
}: {
	title: string;
	label: string;
	side: "left" | "right";
	open: boolean;
	onOpenChange: (open: boolean) => void;
	className?: string;
	children: ReactNode;
}) {
	return (
		<Collapsible
			open={open}
			onOpenChange={onOpenChange}
			data-side={side}
			className={cn("collapsible-side-panel", className)}
		>
			<CollapsibleContent
				render={<section aria-label={label} />}
				className="flex h-full min-h-0 flex-col"
			>
				<div className="flex h-workspace-header shrink-0 items-center border-b px-workspace-gutter">
					<h2 className="font-semibold text-sm">{title}</h2>
				</div>
				<div className="min-h-0 flex-1 overflow-auto p-workspace-gutter">
					{children}
				</div>
			</CollapsibleContent>
			<CollapsibleTrigger
				className="collapsible-side-panel-toggle"
				aria-label={`${open ? "收起" : "展开"}${title}`}
			>
				<span
					aria-hidden="true"
					className="collapsible-side-panel-toggle-top"
				/>
				<span
					aria-hidden="true"
					className="collapsible-side-panel-toggle-bottom"
				/>
			</CollapsibleTrigger>
		</Collapsible>
	);
}

export { CollapsibleSidePanel };
