/**
 * @file 已登录工作台的展示容器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/_workspace/route.tsx。
 * 调用：共享 UI、主图标栏、唯一菜单导航 Provider、文书/笔录资源 Provider 及菜单内容。
 * 功能：按模块授权组合二级菜单、Tooltip 和主内容区；悬浮模式为分栏整体提供外框。
 * 预期结果：通过路由会话检查的页面共用固定导航与布局。
 */
import { canAccessModule } from "@leonwillow-electron/access";
import { TooltipProvider } from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi } from "@tanstack/react-router";
import type { ReactNode } from "react";
import AppSidebar from "@/components/layout/app-sidebar";
import { workspaceMenuIds } from "@/lib/workspace-menu-state";
import { useThemeStore } from "@/stores/theme-store";
import { CalculatorNavigationProvider } from "./calculator-navigation-provider";
import { DocumentNavigationProvider } from "./document-navigation-provider";
import { InquiryNavigationProvider } from "./inquiry-navigation-provider";
import { WorkspaceNavigationProvider } from "./workspace-navigation-provider";
import WorkspacePanels from "./workspace-panels";
import WorkspaceSecondaryMenu from "./workspace-secondary-menu";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
	const sidebarMode = useThemeStore(
		(state) => state.preferences.settings.sidebarMode,
	);
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
						<CalculatorNavigationProvider
							enabled={enabledMenus.includes("calculators")}
						>
							<div
								data-sidebar-mode={sidebarMode}
								className="workspace-shell flex h-dvh w-full min-w-0 overflow-hidden"
							>
								<AppSidebar />
								<div className="workspace-surface flex min-h-0 min-w-0 flex-1">
									<WorkspacePanels
										menu={
											<WorkspaceSecondaryMenu enabledMenus={enabledMenus} />
										}
									>
										{children}
									</WorkspacePanels>
								</div>
							</div>
						</CalculatorNavigationProvider>
					</InquiryNavigationProvider>
				</DocumentNavigationProvider>
			</WorkspaceNavigationProvider>
		</TooltipProvider>
	);
}
