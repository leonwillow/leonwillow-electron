/**
 * @file 工作台的固定图标导航。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/workspace-layout.tsx。
 * 调用：ui 基础组件/样式、ui/lib/utils、@tanstack/react-router、lucide-react、assets/data/navigation、components/layout/auth-links-menu、components/layout/command-menu、components/layout/app-logo、components/layout/mode-toggle、components/layout/profile-menu、components/layout/theme-customizer。
 * 功能：展示主入口及底部菜单，根据当前路径标记选中项。
 * 预期结果：图标提供中文名称，入口可通过键盘和路由访问。
 */
import { buttonVariants } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageSquareTextIcon, SettingsIcon } from "lucide-react";
import { primaryNav, settingsHomeHref } from "@/assets/data/navigation";
import AppLogo from "@/components/layout/app-logo";
import AuthLinksMenu from "@/components/layout/auth-links-menu";
import CommandMenu from "@/components/layout/command-menu";
import ModeToggle from "@/components/layout/mode-toggle";
import ProfileMenu from "@/components/layout/profile-menu";
import ThemeCustomizer from "@/components/layout/theme-customizer";

const isActive = (pathname: string, href: string) =>
	pathname === href || pathname.startsWith(`${href}/`);

const AppSidebar = () => {
	const pathname = useLocation({ select: (location) => location.pathname });
	const settingsActive = isActive(pathname, "/settings");
	const messengerActive = isActive(pathname, "/settings/messenger");

	return (
		<aside className="flex w-16 shrink-0 flex-col items-center overflow-y-auto border-r bg-sidebar pb-3">
			<div className="flex h-14 w-full items-center justify-center border-border border-b">
				<AppLogo />
			</div>

			<nav
				aria-label="主导航"
				className="flex flex-1 flex-col items-center gap-1 pt-2"
			>
				{primaryNav.map((item) => {
					const active = isActive(pathname, item.href);

					return (
						<Tooltip key={item.href}>
							<TooltipTrigger
								render={
									<Link
										to={item.href}
										aria-label={item.title}
										aria-current={active ? "page" : undefined}
										className={cn(
											buttonVariants({
												variant: "ghost",
												size: "icon-lg",
												className: active
													? "bg-primary/10 text-primary before:absolute before:top-1/2 before:-left-2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary hover:bg-primary/10 hover:text-primary focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-1"
													: "hover:bg-primary/10 hover:text-primary",
											}),
											"relative border-0 transition-colors duration-200",
										)}
									>
										<item.icon />
									</Link>
								}
							/>
							<TooltipContent side="right">{item.title}</TooltipContent>
						</Tooltip>
					);
				})}
			</nav>

			<div className="flex flex-col items-center gap-1">
				<AuthLinksMenu />
				<CommandMenu />
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								to="/settings/messenger"
								aria-label="在线消息设置"
								aria-current={messengerActive ? "page" : undefined}
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "icon-lg",
										className: "hover:bg-primary/10 hover:text-primary",
									}),
									"relative border-0 transition-colors duration-200",
								)}
							>
								<MessageSquareTextIcon />
							</Link>
						}
					/>
					<TooltipContent side="right">在线消息设置</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								to={settingsHomeHref}
								aria-label="设置"
								aria-current={settingsActive ? "page" : undefined}
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "icon-lg",
										className: settingsActive
											? "bg-primary/10 text-primary before:absolute before:top-1/2 before:-left-2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary hover:bg-primary/10 hover:text-primary focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-1"
											: "hover:bg-primary/10 hover:text-primary",
									}),
									"relative border-0 transition-colors duration-200",
								)}
							>
								<SettingsIcon />
							</Link>
						}
					/>
					<TooltipContent side="right">设置</TooltipContent>
				</Tooltip>
				<ThemeCustomizer />
				<ModeToggle />
				<ProfileMenu />
			</div>
		</aside>
	);
};

export default AppSidebar;
