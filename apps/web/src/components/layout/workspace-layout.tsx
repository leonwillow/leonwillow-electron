/**
 * @file 已登录工作台的展示容器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/_workspace/route.tsx。
 * 调用：共享 UI、主图标栏、唯一菜单导航 Provider、文书/笔录资源 Provider 及菜单内容。
 * 功能：按模块授权组合一个二级菜单框、Tooltip 和主内容区。
 * 预期结果：通过路由会话检查的页面共用固定导航与布局。
 */
import { canAccessModule } from "@leonwillow-electron/access";
import { TooltipProvider } from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi } from "@tanstack/react-router";
import type { ReactNode } from "react";
import AppSidebar from "@/components/layout/app-sidebar";
import { workspaceMenuIds } from "@/lib/workspace-menu-state";
import { DocumentNavigationProvider } from "./document-navigation-provider";
import { InquiryNavigationProvider } from "./inquiry-navigation-provider";
import { WorkspaceNavigationProvider } from "./workspace-navigation-provider";
import WorkspacePanels from "./workspace-panels";
import WorkspaceSecondaryMenu from "./workspace-secondary-menu";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const enabledMenus = workspaceMenuIds.filter((id) =>
		canAccessModule({ role: user.role, moduleIds }, id),
	);
	return (
		<TooltipProvider>
			<WorkspaceNavigationProvider
				key={user.id}
				userId={user.id}
				enabledMenus={enabledMenus}
			>
				<DocumentNavigationProvider
					enabled={enabledMenus.includes("documents")}
				>
					<InquiryNavigationProvider
						enabled={enabledMenus.includes("inquiries")}
					>
						<div className="flex h-dvh w-full min-w-0 overflow-hidden">
							<AppSidebar />
							<WorkspacePanels
								menu={<WorkspaceSecondaryMenu enabledMenus={enabledMenus} />}
							>
								{children}
							</WorkspacePanels>
						</div>
					</InquiryNavigationProvider>
				</DocumentNavigationProvider>
			</WorkspaceNavigationProvider>
		</TooltipProvider>
	);
}
