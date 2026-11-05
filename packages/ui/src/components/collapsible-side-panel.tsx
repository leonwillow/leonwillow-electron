/**
 * @file 可调整宽度、带边缘折叠按钮的侧面板。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：ReUI 管理分栏尺寸及还原宽度，Base UI 管理内容显隐和按钮语义。
 * 被调用：InquiryRecordEditor；调用：共享 Resizable、Collapsible、cn 和全局面板样式。
 * 预期结果：拖动分隔线调整宽度，点击或键盘收起/恢复；折叠不占空间，不提供悬停预览。
 */

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@leonwillow-electron/ui/components/collapsible";
import {
	type PanelImperativeHandle,
	ResizablePanel,
} from "@leonwillow-electron/ui/components/resizable";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";

function CollapsibleSidePanel({
	id,
	title,
	label,
	side,
	open,
	onOpenChange,
	defaultSize,
	minSize,
	maxSize,
	className,
	children,
}: {
	id: string;
	title: string;
	label: string;
	side: "left" | "right";
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultSize: string;
	minSize: string;
	maxSize: string;
	className?: string;
	children: ReactNode;
}) {
	const panel = useRef<PanelImperativeHandle>(null);
	// defaultSize 只用于挂载；保持稳定，避免重新注册面板而丢失官方记录的展开尺寸。
	const [initialSize] = useState(() => (open ? defaultSize : "0%"));
	// 父级分栏先在 layout effect 注册，随后才能调用面板命令。
	useEffect(() => {
		if (open) panel.current?.expand();
		else panel.current?.collapse();
	}, [open]);

	return (
		<ResizablePanel
			id={id}
			panelRef={panel}
			defaultSize={initialSize}
			minSize={minSize}
			maxSize={maxSize}
			collapsible
			collapsedSize="0%"
			groupResizeBehavior="preserve-pixel-size"
			style={{ overflow: "visible" }}
			onResize={(size, _id, previous) => {
				// 拖动越过折叠阈值或键盘收起时，也同步按钮与内容状态。
				if (previous) onOpenChange(size.asPercentage > 0);
			}}
		>
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
					<ScrollArea
						className="min-h-0 flex-1"
						contentClassName="p-workspace-gutter"
					>
						{children}
					</ScrollArea>
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
		</ResizablePanel>
	);
}

export { CollapsibleSidePanel };
