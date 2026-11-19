/**
 * @file 当前用户身份信息、个人设置与账号操作菜单。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-19
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、@tanstack/react-router、lucide-react、react、sonner、assets/data/navigation、lib/auth。
 * 功能：展示真实姓名、登录账号与角色标签，承载个人设置入口并执行危险色退出登录。
 * 预期结果：通过路由命令跳转避免浏览器左下角链接预览遮挡，退出成功后返回登录，失败时提示错误。
 */
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@leonwillow-electron/ui/components/avatar";
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { getRouteApi, useLocation, useRouter } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { settingsNav } from "@/assets/data/navigation";
import { authErrorMessage, logout } from "@/lib/auth";

// 按路由 ID 取得类型化 API，避免菜单反向导入挂载它的路由模块。
const workspaceRoute = getRouteApi("/_workspace");

const ProfileMenu = () => {
	const user = workspaceRoute.useRouteContext({ select: ({ user }) => user });
	const pathname = useLocation({ select: (location) => location.pathname });
	const initials = Array.from(user.name).slice(0, 2).join("").toUpperCase();
	const settingsActive = settingsNav.some((item) => item.href === pathname);
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const onLogout = async () => {
		setIsLoggingOut(true);
		try {
			await logout();
			await router.navigate({ to: "/login", replace: true });
		} catch (error) {
			toast.error(authErrorMessage(error));
		} finally {
			setIsLoggingOut(false);
		}
	};

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger
					render={
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size="icon-workspace"
									className="workspace-nav-item rounded-full p-0"
									aria-label="打开个人菜单"
									aria-current={settingsActive ? "location" : undefined}
								/>
							}
						/>
					}
				>
					<Avatar className="size-full">
						<AvatarImage src={user.image ?? undefined} alt={user.name} />
						<AvatarFallback className="font-medium text-xs transition-colors">
							{initials}
						</AvatarFallback>
					</Avatar>
				</TooltipTrigger>
				<TooltipContent side="right">个人菜单</TooltipContent>
			</Tooltip>
			<DropdownMenuContent
				side="right"
				align="end"
				sideOffset={8}
				className="w-60"
			>
				<div className="flex items-center gap-2.5 px-2 py-1.5">
					<Avatar className="size-9 shrink-0">
						<AvatarImage src={user.image ?? undefined} alt={user.name} />
						<AvatarFallback className="font-medium text-xs">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<div className="flex items-center gap-1.5">
							<span className="truncate font-medium text-sm">{user.name}</span>
							<Badge variant="secondary">
								{user.role === "admin" ? "管理员" : "普通人员"}
							</Badge>
						</div>
						<span className="truncate text-muted-foreground text-xs">
							@{user.username}
						</span>
					</div>
				</div>

				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{settingsNav.map((item) => {
						const active = pathname === item.href;
						return (
							<DropdownMenuItem
								key={item.href}
								aria-current={active ? "page" : undefined}
								onClick={() => void router.navigate({ to: item.href })}
								className={cn(active && "bg-accent text-accent-foreground")}
							>
								<item.icon />
								{item.title}
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						variant="destructive"
						onClick={onLogout}
						disabled={isLoggingOut}
					>
						<LogOutIcon />
						{isLoggingOut ? "正在退出…" : "退出登录"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileMenu;
