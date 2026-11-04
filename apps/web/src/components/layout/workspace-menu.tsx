/**
 * @file 工作台二级菜单的共享外框、标题和工具栏。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：只挂载一个菜单框，切换业务内容时复用同一个顶栏、固定按钮及面板节点。
 * 被调用：WorkspaceSecondaryMenu；内容来自资金、文书与笔录菜单 Hook。
 * 调用：useWorkspaceMenu 导航契约、共享 Button、Tooltip 及工作区尺寸令牌。
 * 功能与预期结果：标题居左，固定按钮始终排在工具栏末尾；浮动时留出边距，停靠时衔接工作区。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipPortalScope,
	TooltipText,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { PinIcon, PinOffIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceMenuNavigation } from "./use-workspace-menu";

export type WorkspaceMenuContent = {
	/** 当前内容的菜单名称，用于区域及工具栏；固定按钮始终描述整个二级菜单框。 */
	label: string;
	title: string;
	/** 业务操作按传入顺序显示，固定按钮由外框追加。 */
	toolbar?: ReactNode;
	children: ReactNode;
	dialogs?: ReactNode;
};

type WorkspaceMenuProps = WorkspaceMenuContent & {
	navigation: WorkspaceMenuNavigation;
};

/** 浮层收起只卸载菜单视图；内容 Hook 和业务弹窗由外层持续持有。 */
export default function WorkspaceMenu({
	label,
	title,
	navigation,
	toolbar,
	children,
}: WorkspaceMenuProps) {
	if (!navigation.visible) return null;
	const pinLabel = navigation.pinned ? "取消固定二级菜单" : "固定二级菜单";
	return (
		<aside
			id="workspace-menu"
			data-slot="workspace-menu"
			data-menu={navigation.activeMenu}
			data-mode={navigation.docked ? "docked" : "floating"}
			ref={navigation.panelRef}
			aria-label={label}
			onPointerEnter={() => navigation.show()}
			onPointerLeave={navigation.scheduleClose}
			onFocusCapture={() => navigation.show()}
			onBlurCapture={navigation.scheduleClose}
			className={cn(
				"flex max-w-full shrink-0 flex-col bg-sidebar",
				navigation.docked
					? "relative h-full w-full"
					: "workspace-menu-floating absolute inset-y-0 left-0 z-40 w-workspace-menu rounded-xl border shadow-xl",
			)}
		>
			<TooltipPortalScope>
				<div
					data-slot="workspace-header"
					className="flex h-workspace-header shrink-0 items-center justify-between gap-3 border-b px-workspace-gutter"
				>
					<TooltipText content={title}>
						<h2 className="min-w-0 flex-1 truncate font-semibold text-base">
							{title}
						</h2>
					</TooltipText>
					<fieldset
						aria-label={`${label}工具栏`}
						className="flex shrink-0 items-center gap-1"
					>
						{toolbar}
						<Tooltip>
							<TooltipTrigger
								closeOnClick={false}
								render={
									<Button
										size="icon"
										variant="ghost"
										aria-label={pinLabel}
										aria-pressed={navigation.pinned}
										onClick={navigation.togglePinned}
									/>
								}
							>
								{navigation.pinned ? <PinOffIcon /> : <PinIcon />}
							</TooltipTrigger>
							<TooltipContent>{pinLabel}</TooltipContent>
						</Tooltip>
					</fieldset>
				</div>
				{children}
			</TooltipPortalScope>
		</aside>
	);
}
