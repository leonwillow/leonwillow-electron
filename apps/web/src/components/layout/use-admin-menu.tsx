/**
 * @file 管理中心二级菜单的目录内容。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：接入统一工作台二级菜单框，让管理入口与业务模块共享浮层/固定交互。
 * 被调用：components/layout/workspace-secondary-menu.tsx。
 * 调用：共享 Button/ScrollArea、assets/data/navigation、路由与工作台导航上下文。
 * 功能：按管理目录渲染可导航项并同步当前路由选中态；点击跳转后在未固定时收起浮层。
 * 预期结果：管理员在侧栏悬停或点击管理中心即可浏览并切换全部管理页面。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { adminNav } from "@/assets/data/navigation";
import type { WorkspaceMenuContent } from "./workspace-menu";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

export function useAdminMenu(): WorkspaceMenuContent {
	const menu = useWorkspaceNavigation();
	const pathname = useLocation({
		select: (location) => location.pathname.replace(/\/$/, ""),
	});
	const navigate = useNavigate();

	return {
		label: "管理中心菜单",
		title: "管理中心",
		children: (
			<ScrollArea
				aria-label="管理中心菜单列表"
				className="min-h-0 flex-1"
				contentClassName="w-full min-w-0! p-workspace-gutter"
				render={<nav />}
			>
				<ul className="flex flex-col gap-1">
					{adminNav.map((item) => {
						const selected =
							pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<li key={item.href} data-menu-row>
								<Button
									variant="ghost"
									size="lg"
									aria-current={selected ? "page" : undefined}
									onClick={() => {
										menu.dismiss();
										void navigate({ to: item.href });
									}}
									className={cn(
										"w-full justify-start",
										selected &&
											"bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
									)}
								>
									<item.icon aria-hidden="true" />
									<span className="min-w-0 flex-1 truncate text-left">
										{item.title}
									</span>
								</Button>
							</li>
						);
					})}
				</ul>
			</ScrollArea>
		),
	};
}
