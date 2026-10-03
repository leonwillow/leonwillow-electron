import { TooltipProvider } from "@leonwillow-electron/ui/components/tooltip";
import type { ReactNode } from "react";
import AppSidebar from "@/components/layout/AppSidebar";
import { currentUser } from "@/configs/workspace";
import { CurrentUserProvider } from "@/contexts/current-user-context";

// 迁移自原项目 src/app/(dashboard)/layout.tsx；本阶段不加载业务数据。
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
	return (
		<CurrentUserProvider user={currentUser}>
			<TooltipProvider>
				<div className="flex h-dvh w-full min-w-0 overflow-hidden">
					<AppSidebar />
					<main
						aria-label="工作区内容"
						className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
					>
						{children}
					</main>
				</div>
			</TooltipProvider>
		</CurrentUserProvider>
	);
}
