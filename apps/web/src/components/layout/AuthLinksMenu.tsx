// Router Imports

// Component Imports
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
// Third-party Imports
import {
	FileQuestionIcon,
	KeyRoundIcon,
	LockKeyholeIcon,
	LogInIcon,
	UserPlusIcon,
} from "lucide-react";

// Auth pages open in a separate (blank) layout, so this quick-access menu makes
// them reachable from the app shell for testing and review.
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
