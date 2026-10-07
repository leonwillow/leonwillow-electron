/**
 * @file 资金分析模块的共享页头与内部导航。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：顶栏与案件菜单共用高度，模块与案件名按路径层级排列。
 * 被调用：FundsView、CasesView；调用：共享按钮样式与 TanStack Link。
 * 功能：显示模块标题及可选案件名，切换内部页面时携带 caseId。
 * 预期结果：顶栏分隔线一致，长案件名不撑高页头，窄窗口保留内部导航。
 */

import { buttonVariants } from "@leonwillow-electron/ui/components/button";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

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
	return (
		<header
			data-slot="workspace-header"
			className="flex h-workspace-header shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6"
		>
			<div className="flex min-w-0 flex-1 flex-col justify-center sm:flex-row sm:items-center sm:justify-start sm:gap-3">
				<h1 className="shrink-0 whitespace-nowrap font-semibold text-base">
					资金分析
				</h1>
				{caseName && (
					<>
						<ChevronRightIcon
							aria-hidden="true"
							className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
						/>
						<TooltipText content={caseName}>
							<p className="min-w-0 truncate text-muted-foreground text-xs sm:text-sm">
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
					{sections.map((section) => (
						<Link
							key={section.to}
							to={section.to}
							search={{ caseId }}
							activeOptions={{ exact: true, includeSearch: false }}
							aria-current={
								pathname.replace(/\/$/, "") === section.to ? "page" : undefined
							}
							className={cn(
								buttonVariants({
									variant:
										pathname.replace(/\/$/, "") === section.to
											? "secondary"
											: "ghost",
								}),
							)}
						>
							{section.title}
						</Link>
					))}
				</nav>
			)}
		</header>
	);
}
