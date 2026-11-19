/**
 * @file 仅管理员可见的管理中心菜单。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-19
 * 版本作用：在工作台图标栏提供独立于个人设置的管理入口。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：共享 UI、权限目录、工作台路由上下文、assets/data/navigation。
 * 功能：根据真实会话显示管理菜单，并标记当前管理页面。
 * 预期结果：管理员从统一菜单进入管理功能，普通人员不显示此入口。
 */
import { routeRequirement } from "@leonwillow-electron/access";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ShieldCheckIcon } from "lucide-react";
import { adminNav } from "@/assets/data/navigation";

export default function AdminMenu({ wide = false }: { wide?: boolean }) {
	const role = getRouteApi("/_workspace").useRouteContext({
		select: ({ user }) => user.role,
	});
	const pathname = useLocation({ select: (location) => location.pathname });
	const navigate = useNavigate();
	if (role !== "admin") return null;
	const active = routeRequirement(pathname) === "admin";

	return (
		<DropdownMenu>
			<Tooltip disabled={wide}>
				<TooltipTrigger
					render={
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size={wide ? "lg" : "icon-workspace"}
									aria-label="管理中心"
									aria-current={active ? "location" : undefined}
									className={cn(
										"workspace-nav-item",
										wide && "w-full justify-start gap-2.5 px-2.5",
									)}
								>
									<ShieldCheckIcon aria-hidden="true" />
									{wide && (
										<>
											<span className="min-w-0 flex-1 truncate text-left">
												管理中心
											</span>
											<ChevronRightIcon
												className="size-3.5 text-muted-foreground/60"
												aria-hidden="true"
											/>
										</>
									)}
								</Button>
							}
						/>
					}
				/>
				<TooltipContent side="right">管理中心</TooltipContent>
			</Tooltip>
			<DropdownMenuContent
				side="right"
				align="end"
				sideOffset={14}
				className="w-52"
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel>管理中心</DropdownMenuLabel>
					{adminNav.map((item) => (
						<DropdownMenuItem
							key={item.href}
							aria-current={pathname === item.href ? "page" : undefined}
							onClick={() => void navigate({ to: item.href })}
							className={cn(
								pathname === item.href && "bg-accent text-accent-foreground",
							)}
						>
							<item.icon />
							{item.title}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
