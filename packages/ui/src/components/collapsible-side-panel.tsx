/**
 * @file 可调整宽度、带边缘折叠按钮的侧面板。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：ReUI 管理分栏尺寸及还原宽度，Base UI 管理内容显隐和按钮语义。
 * 被调用：InquiryRecordEditor；调用：共享 Resizable、Collapsible、cn 和全局面板样式。
 * 预期结果：拖动仅在最小/最大宽度间调整，折叠按钮独立收起/恢复；折叠不占空间。
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
	scrollable = true,
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
	/** 内容自带有界滚动区域时关闭，避免嵌套滚动和浮动工具栏随内容移动。 */
	scrollable?: boolean;
	children: ReactNode;
}) {
	const panel = useRef<PanelImperativeHandle>(null);
	const expandedSize = useRef<number | string>(defaultSize);
	const [settledOpen, setSettledOpen] = useState(open);
	// defaultSize 只用于挂载；切换显隐时不使用它覆盖用户调好的宽度。
	const [initialSize] = useState(() => (open ? defaultSize : "0%"));
	// 先放开约束并通过官方 API 调宽，再收紧约束；避免约束校正直接挤压另一侧面板。
	// min/max 变化会重新注册面板，尺寸命令放在下一帧，清理时取消尚未执行的切换。
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			panel.current?.resize(open ? expandedSize.current : "0%");
			setSettledOpen(open);
		});
		return () => cancelAnimationFrame(frame);
	}, [open]);

	function changeOpen(nextOpen: boolean) {
		// 在收起导致尺寸约束归零前记录展开宽度，恢复时仍由 ReUI 应用可用空间约束。
		if (open && !nextOpen) {
			const size = panel.current?.getSize().inPixels;
			if (size) expandedSize.current = size;
		}
		onOpenChange(nextOpen);
	}

	return (
		<ResizablePanel
			id={id}
			panelRef={panel}
			defaultSize={initialSize}
			minSize={open && settledOpen ? minSize : "0%"}
			maxSize={!open && !settledOpen ? "0%" : maxSize}
			disabled={!open}
			groupResizeBehavior="preserve-pixel-size"
			style={{ overflow: "visible" }}
		>
			<Collapsible
				open={open}
				onOpenChange={changeOpen}
				data-side={side}
				className={cn("collapsible-side-panel", className)}
			>
				<CollapsibleContent
					render={<section aria-label={label} />}
					className="flex h-full min-h-0 min-w-0 flex-col"
				>
					<div className="flex h-workspace-header shrink-0 items-center border-b px-workspace-gutter">
						<h2 className="font-semibold text-sm">{title}</h2>
					</div>
					{scrollable ? (
						<ScrollArea
							className="min-h-0 flex-1"
							contentClassName="p-workspace-gutter"
						>
							{children}
						</ScrollArea>
					) : (
						children
					)}
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
