/**
 * @file 工作台中的认证页面快捷入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、@tanstack/react-router、lucide-react。
 * 功能：组合登录、注册、密码相关与 404 路由链接。
 * 预期结果：认证页面在工作台布局之外打开；空白出口不模拟业务结果。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import {
	FileQuestionIcon,
	KeyRoundIcon,
	LockKeyholeIcon,
	LogInIcon,
	UserPlusIcon,
} from "lucide-react";

const AuthLinksMenu = () => (
	<DropdownMenu>
		<Tooltip>
			<TooltipTrigger
				render={
					<DropdownMenuTrigger
						render={
							<Button
								className="hover:bg-primary/10 hover:text-primary"
								variant="ghost"
								size="icon-lg"
								aria-label="认证页面"
							>
								<KeyRoundIcon />
							</Button>
						}
					/>
				}
			/>
			<TooltipContent side="right">认证页面</TooltipContent>
		</Tooltip>

		<DropdownMenuContent
			side="right"
			align="end"
			sideOffset={8}
			className="w-52"
		>
			<DropdownMenuGroup>
				<DropdownMenuLabel>认证</DropdownMenuLabel>
				<DropdownMenuItem render={<Link to="/login" />}>
					<LogInIcon />
					登录
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link to="/register" />}>
					<UserPlusIcon />
					注册
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link to="/forgot-password" />}>
					<KeyRoundIcon />
					忘记密码
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link to="/reset-password" />}>
					<LockKeyholeIcon />
					重置密码
				</DropdownMenuItem>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuGroup>
				<DropdownMenuItem render={<Link to="/404" />}>
					<FileQuestionIcon />
					404 页面
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</DropdownMenuContent>
	</DropdownMenu>
);

export default AuthLinksMenu;
