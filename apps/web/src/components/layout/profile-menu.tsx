/**
 * @file 当前用户资料与账号操作菜单。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-08
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、@tanstack/react-router、lucide-react、react、sonner、assets/data/navigation、configs/app、lib/auth。
 * 功能：读取工作台路由的公开用户资料，显示账号菜单并等待服务端确认退出。
 * 预期结果：退出成功后刷新会话并返回登录，失败时显示错误。
 */
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@leonwillow-electron/ui/components/avatar";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { LogOutIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { settingsHomeHref } from "@/assets/data/navigation";
import { appConfig } from "@/configs/app";
import { authErrorMessage, logout } from "@/lib/auth";

// 按路由 ID 取得类型化 API，避免菜单反向导入挂载它的路由模块。
const workspaceRoute = getRouteApi("/_workspace");

const ProfileMenu = () => {
	const user = workspaceRoute.useRouteContext({ select: ({ user }) => user });
	const initials = Array.from(user.name).slice(0, 2).join("").toUpperCase();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const onLogout = async () => {
		setIsLoggingOut(true);
		try {
			await logout();
			await router.invalidate();
			await router.navigate({ to: "/login", replace: true });
		} catch (error) {
			toast.error(authErrorMessage(error));
		} finally {
			setIsLoggingOut(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-workspace"
						className="relative rounded-full border-0"
						aria-label="打开个人菜单"
					/>
				}
			>
				<Avatar className="size-full">
					<AvatarImage src={user.image ?? undefined} alt={user.name} />
					<AvatarFallback>{initials}</AvatarFallback>
				</Avatar>
				<span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-presence-online ring-2 ring-sidebar" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="right"
				align="end"
				sideOffset={8}
				className="w-60"
			>
				<div className="flex items-center gap-2 p-2">
					<div className="relative shrink-0">
						<Avatar className="size-9">
							<AvatarImage src={user.image ?? undefined} alt={user.name} />
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
						<span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-presence-online ring-2 ring-popover" />
					</div>
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-medium text-sm">{user.name}</span>
						<span className="truncate text-muted-foreground text-xs">在线</span>
					</div>
				</div>

				<DropdownMenuSeparator />
				<div className="flex items-center justify-between gap-2 px-2 py-1.5">
					<span className="text-muted-foreground text-xs">工作区</span>
					<span className="max-w-[60%] truncate font-medium text-xs">
						{appConfig.workspaceName}
					</span>
				</div>

				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem render={<Link to={settingsHomeHref} />}>
						<UserIcon />
						个人资料
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={onLogout} disabled={isLoggingOut}>
						<LogOutIcon />
						退出登录
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileMenu;
