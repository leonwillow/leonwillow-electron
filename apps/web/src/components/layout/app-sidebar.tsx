/**
 * @file 工作台的固定图标导航。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-06
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/workspace-layout.tsx。
 * 调用：ui 基础组件/样式、路由、导航目录、管理中心菜单、搜索、品牌、主题与个人菜单。
 * 功能：按当前授权展示入口与管理菜单，根据路径标记选中项。
 * 预期结果：图标提供中文名称，入口可通过键盘和路由访问。
 */

import { canAccessModule } from "@leonwillow-electron/access";
import { buttonVariants } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	getRouteApi,
	Link,
	useLocation,
	useSearch,
} from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { primaryNav, settingsHomeHref } from "@/assets/data/navigation";
import AdminMenu from "@/components/layout/admin-menu";
import AppLogo from "@/components/layout/app-logo";
import CommandMenu from "@/components/layout/command-menu";
import ModeToggle from "@/components/layout/mode-toggle";
import ProfileMenu from "@/components/layout/profile-menu";
import ThemeCustomizer from "@/components/layout/theme-customizer";
import { useFundsNavigation } from "./funds-navigation-provider";

const isActive = (pathname: string, href: string) =>
	pathname === href || pathname.startsWith(`${href}/`);

const AppSidebar = () => {
	const fundsMenu = useFundsNavigation();
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const pathname = useLocation({ select: (location) => location.pathname });
	const { caseId } = useSearch({ strict: false });
	const settingsActive = [settingsHomeHref, "/settings/notifications"].includes(
		pathname,
	);

	return (
		<aside className="flex w-16 shrink-0 flex-col items-center overflow-y-auto border-r bg-sidebar pb-3">
			<div
				data-slot="workspace-header"
				className="flex h-workspace-header w-full shrink-0 items-center justify-center border-border border-b"
			>
				<AppLogo />
			</div>

			<nav
				aria-label="主导航"
				className="flex flex-1 flex-col items-center gap-1 pt-2"
			>
				{primaryNav
					.filter((item) =>
						canAccessModule({ role: user.role, moduleIds }, item.id),
					)
					.map((item) => {
						const active = isActive(pathname, item.href);

						return (
							<Tooltip key={item.href}>
								<TooltipTrigger
									render={
										<Link
											ref={
												item.id === "funds" ? fundsMenu.triggerRef : undefined
											}
											aria-controls={
												item.id === "funds" ? "funds-case-menu" : undefined
											}
											aria-expanded={
												item.id === "funds" ? fundsMenu.visible : undefined
											}
											onPointerEnter={
												item.id === "funds" && !fundsMenu.pinned
													? fundsMenu.show
													: undefined
											}
											onPointerLeave={
												item.id === "funds"
													? fundsMenu.scheduleClose
													: undefined
											}
											onFocus={
												item.id === "funds" && !fundsMenu.pinned
													? fundsMenu.show
													: undefined
											}
											onBlur={
												item.id === "funds"
													? fundsMenu.scheduleClose
													: undefined
											}
											onClick={item.id === "funds" ? fundsMenu.show : undefined}
											onKeyDown={
												item.id === "funds"
													? (event) => {
															if (
																event.key === "ArrowRight" ||
																(event.key === "Tab" &&
																	!event.shiftKey &&
																	fundsMenu.visible)
															) {
																event.preventDefault();
																fundsMenu.focusPanel();
															}
														}
													: undefined
											}
											to={item.href}
											activeOptions={{ exact: false }}
											search={item.id === "funds" ? { caseId } : undefined}
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
								{(item.id !== "funds" || fundsMenu.pinned) && (
									<TooltipContent side="right">{item.title}</TooltipContent>
								)}
							</Tooltip>
						);
					})}
			</nav>

			<div className="flex flex-col items-center gap-1">
				<CommandMenu />
				<AdminMenu />
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								to={settingsHomeHref}
								aria-label="个人设置"
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
					<TooltipContent side="right">个人设置</TooltipContent>
				</Tooltip>
				<ThemeCustomizer />
				<ModeToggle />
				<ProfileMenu />
			</div>
		</aside>
	);
};

export default AppSidebar;
