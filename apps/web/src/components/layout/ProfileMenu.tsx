// Router Imports

// Component Imports
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
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { Link } from "@tanstack/react-router";
// Third-party Imports
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
// Data Imports
import { settingsHomeHref } from "@/assets/data/navigation";
// Config Imports
import { workspaceName } from "@/configs/workspace";
// Context Imports
import { useCurrentUser } from "@/contexts/current-user-context";
// Utils Imports
import { presenceDotClass, presenceLabel } from "@/utils/presence";

const ProfileMenu = () => {
	const user = useCurrentUser();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-lg"
						className="relative rounded-full"
						aria-label="打开个人菜单"
					/>
				}
			>
				<Avatar className="size-8">
					<AvatarImage src={user.avatar} alt={user.name} />
					<AvatarFallback>{user.initials}</AvatarFallback>
				</Avatar>
				{/* 当前用户状态来自共享上下文。 */}
				<span
					className={cn(
						"absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-sidebar",
						presenceDotClass(user.presence),
					)}
				/>
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
							<AvatarImage src={user.avatar} alt={user.name} />
							<AvatarFallback>{user.initials}</AvatarFallback>
						</Avatar>
						<span
							className={cn(
								"absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-popover",
								presenceDotClass(user.presence),
							)}
						/>
					</div>
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-medium text-sm">{user.name}</span>
						<span className="truncate text-muted-foreground text-xs">
							{presenceLabel[user.presence]}
						</span>
					</div>
				</div>

				<DropdownMenuSeparator />
				<div className="flex items-center justify-between gap-2 px-2 py-1.5">
					<span className="text-muted-foreground text-xs">工作区</span>
					<span className="max-w-[60%] truncate font-medium text-xs">
						{workspaceName}
					</span>
				</div>

				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem render={<Link to="/settings/profile" />}>
						<UserIcon />
						个人资料
					</DropdownMenuItem>
					<DropdownMenuItem render={<Link to={settingsHomeHref} />}>
						<SettingsIcon />
						设置
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem render={<Link to="/login" />}>
						<LogOutIcon />
						退出登录
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default ProfileMenu;
