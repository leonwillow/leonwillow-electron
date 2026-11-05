/**
 * @file 工作台二级菜单与正文的 ReUI 分栏容器。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：固定时通过无胶囊标记的分隔线调整宽度，浮动时将菜单占位收为零。
 * 被调用：WorkspaceLayout；调用：共享 ReUI Resizable、菜单导航上下文及共享尺寸令牌。
 * 预期结果：切换固定状态不重建菜单或编辑器；拖动结束保存统一宽度，窄窗不覆盖宽度偏好。
 */
import {
	type PanelImperativeHandle,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@leonwillow-electron/ui/components/resizable";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

/** 尺寸只在共享 CSS 定义；ReUI 接受带 rem 单位的长度，不接受 CSS var 表达式。 */
function readPanelSizes() {
	const styles = getComputedStyle(document.documentElement);
	return {
		defaultSize: styles
			.getPropertyValue("--workspace-menu-default-size")
			.trim(),
		minSize: styles.getPropertyValue("--workspace-menu-min-size").trim(),
		maxSize: styles.getPropertyValue("--workspace-menu-max-size").trim(),
		contentMinSize: styles
			.getPropertyValue("--workspace-content-min-size")
			.trim(),
	};
}

export default function WorkspacePanels({
	menu,
	children,
}: {
	menu: ReactNode;
	children: ReactNode;
}) {
	const { docked, widthRem, setWidthRem } = useWorkspaceNavigation();
	const [sizes] = useState(readPanelSizes);
	const groupElement = useRef<HTMLDivElement>(null);
	const separatorElement = useRef<HTMLDivElement>(null);
	const menuPanel = useRef<PanelImperativeHandle>(null);
	const desiredSize = widthRem === null ? sizes.defaultSize : `${widthRem}rem`;

	useLayoutEffect(() => {
		const group = groupElement.current;
		if (!group) return;
		// 主图标栏随 rem 缩放会改变分栏可用宽度；重新应用偏好而不保存受视口限制的临时值。
		const applySize = () =>
			menuPanel.current?.resize(docked ? desiredSize : "0%");
		applySize();
		const observer = new ResizeObserver(applySize);
		observer.observe(group);
		return () => observer.disconnect();
	}, [docked, desiredSize]);

	return (
		<ResizablePanelGroup
			id="workspace-panels"
			elementRef={groupElement}
			orientation="horizontal"
			disabled={!docked}
			className="relative min-h-0 min-w-0 flex-1"
			style={{ overflow: "visible" }}
			onLayoutChanged={(layout, { isUserInteraction }) => {
				const group = groupElement.current;
				const percentage = layout["workspace-menu-panel"];
				if (!docked || !isUserInteraction || !group || percentage === undefined)
					return;
				// 键盘回调可能早于面板 DOM 更新；用官方提交的比例换算，不能读取旧的面板宽度。
				const availableWidth =
					group.getBoundingClientRect().width -
					(separatorElement.current?.getBoundingClientRect().width ?? 0);
				const rootFont = Number.parseFloat(
					getComputedStyle(document.documentElement).fontSize,
				);
				setWidthRem(((percentage / 100) * availableWidth) / rootFont);
			}}
		>
			<ResizablePanel
				id="workspace-menu-panel"
				panelRef={menuPanel}
				defaultSize={docked ? desiredSize : "0%"}
				minSize={docked ? sizes.minSize : "0%"}
				maxSize={docked ? sizes.maxSize : "0%"}
				groupResizeBehavior="preserve-pixel-size"
				style={{ overflow: "visible" }}
			>
				{menu}
			</ResizablePanel>
			<ResizableHandle
				id="workspace-menu-separator"
				elementRef={separatorElement}
				aria-label="调整二级菜单宽度"
				disabled={!docked}
				className={cn(!docked && "hidden")}
			/>
			<ResizablePanel
				id="workspace-content-panel"
				minSize={docked ? sizes.contentMinSize : "0%"}
				className="flex min-h-0 min-w-0 flex-col"
				style={{ overflow: "hidden" }}
			>
				<main
					aria-label="工作区内容"
					className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
				>
					{children}
				</main>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
