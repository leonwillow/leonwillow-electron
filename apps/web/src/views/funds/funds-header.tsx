/**
 * @file 资金分析模块的共享页头与内部导航。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-19
 * 版本作用：顶栏与案件菜单共用高度，模块与案件名按路径层级排列。
 * 被调用：FundsView、CasesView；调用：共享工作区标题栏、共享 Button 与 TanStack Router。
 * 功能：显示模块标题及可选案件名，切换内部页面时携带 caseId。
 * 预期结果：顶栏分隔线一致，长案件名不撑高页头，窄窗口允许导航换行。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, WaypointsIcon } from "lucide-react";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";

const sections = [
	{ title: "分析", to: "/funds" },
	{ title: "案件管理", to: "/funds/cases" },
] as const;

export default function FundsHeader({
	caseId,
	caseName,
}: {
	caseId?: string;
	caseName?: string;
}) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const navigate = useNavigate();
	return (
		<WorkspaceHeader className="justify-between">
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<WorkspaceTitle icon={WaypointsIcon}>资金分析</WorkspaceTitle>
				{caseName && (
					<>
						<ChevronRightIcon
							aria-hidden="true"
							className="size-4 shrink-0 text-muted-foreground"
						/>
						<TooltipText content={caseName}>
							<p className="min-w-0 truncate text-muted-foreground text-sm">
								{caseName}
							</p>
						</TooltipText>
					</>
				)}
			</div>
			{caseId && (
				<nav
					aria-label="资金分析内部导航"
					className="flex shrink-0 items-center gap-1"
				>
					{sections.map((section) => {
						const active = pathname.replace(/\/$/, "") === section.to;
						return (
							<Button
								key={section.to}
								variant={active ? "secondary" : "ghost"}
								aria-current={active ? "page" : undefined}
								onClick={() =>
									void navigate({ to: section.to, search: { caseId } })
								}
							>
								{section.title}
							</Button>
						);
					})}
				</nav>
			)}
		</WorkspaceHeader>
	);
}
