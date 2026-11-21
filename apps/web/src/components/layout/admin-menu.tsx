/**
 * @file 仅管理员可见的管理中心侧栏入口。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-21
 * 版本作用：接入工作台统一二级菜单，未固定时悬停直接展开管理二级菜单而非提示气泡。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：共享 UI（Button/HoverCardTrigger/Tooltip）、权限目录、工作台导航上下文与路由。
 * 功能：根据真实会话显示管理入口，标记当前管理路由并支持键盘与固定面板切换。
 * 预期结果：管理员悬停或点击即可展开统一二级菜单，普通人员不显示此入口。
 */
import { routeRequirement } from "@leonwillow-electron/access";
import { Button } from "@leonwillow-electron/ui/components/button";
import { HoverCardTrigger } from "@leonwillow-electron/ui/components/hover-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ShieldCheckIcon } from "lucide-react";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

export default function AdminMenu({ wide = false }: { wide?: boolean }) {
	const role = getRouteApi("/_workspace").useRouteContext({
		select: ({ user }) => user.role,
	});
	const menu = useWorkspaceNavigation();
	const pathname = useLocation({ select: (location) => location.pathname });
	const navigate = useNavigate();
	if (role !== "admin") return null;
	const active = routeRequirement(pathname) === "admin";
	const expanded = menu.visible && menu.activeMenu === "admin";

	const trigger = (
		<Button
			ref={menu.triggerRefs.admin}
			variant="ghost"
			size={wide ? "lg" : "icon-workspace"}
			aria-label={wide ? undefined : "管理中心"}
			aria-controls="workspace-menu"
			aria-expanded={expanded}
			aria-current={active ? "location" : undefined}
			onClick={() => {
				menu.show("admin");
				if (!active) void navigate({ to: "/admin/users" });
			}}
			onKeyDown={(event) => {
				if (
					(!menu.pinned || menu.activeMenu === "admin") &&
					(event.key === "ArrowRight" ||
						(event.key === "Tab" && !event.shiftKey && expanded))
				) {
					event.preventDefault();
					menu.focusPanel("admin");
				}
			}}
			className={cn(
				"workspace-nav-item",
				wide && "w-full justify-start gap-2.5 px-2.5",
			)}
		>
			<ShieldCheckIcon aria-hidden="true" />
			{wide && (
				<>
					<span className="min-w-0 flex-1 truncate text-left">管理中心</span>
					<ChevronRightIcon
						className="size-3.5 text-muted-foreground/60"
						aria-hidden="true"
					/>
				</>
			)}
		</Button>
	);

	return (
		<Tooltip disabled={wide || !menu.pinned}>
			<TooltipTrigger
				render={
					<HoverCardTrigger
						id="workspace-trigger-admin"
						data-menu-trigger="admin"
						handle={menu.hoverHandle}
						payload="admin"
						delay={150}
						closeDelay={180}
						render={trigger}
					/>
				}
			/>
			<TooltipContent side="right">管理中心</TooltipContent>
		</Tooltip>
	);
}
