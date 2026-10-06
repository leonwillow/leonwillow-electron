/**
 * @file 已登录工作台的展示容器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-06
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/_workspace/route.tsx。
 * 调用：ui 基础组件/样式、react、components/layout/app-sidebar。
 * 功能：组合工作台侧栏、Tooltip 和主内容区。
 * 预期结果：通过路由会话检查的页面共用固定导航与布局。
 */
import { canAccessModule } from "@leonwillow-electron/access";
import { TooltipProvider } from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi } from "@tanstack/react-router";
import type { ReactNode } from "react";
import AppSidebar from "@/components/layout/app-sidebar";
import FundsCaseSidebar from "./funds-case-sidebar";
import { FundsNavigationProvider } from "./funds-navigation-provider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	return (
		<TooltipProvider>
			<FundsNavigationProvider key={user.id} userId={user.id}>
				<div className="flex h-dvh w-full min-w-0 overflow-hidden">
					<AppSidebar />
					<div className="relative flex min-h-0 min-w-0 flex-1">
						{canAccessModule({ role: user.role, moduleIds }, "funds") && (
							<FundsCaseSidebar />
						)}
						<main
							aria-label="工作区内容"
							className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
						>
							{children}
						</main>
					</div>
				</div>
			</FundsNavigationProvider>
		</TooltipProvider>
	);
}
