/**
 * @file 工作台的固定图标导航。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/workspace-layout.tsx。
 * 调用：共享 UI、路由、导航目录、工作台统一导航上下文、管理中心、搜索、品牌、主题与个人菜单。
 * 功能：按侧栏可见配置与授权展示入口；未固定时悬停预览，固定时点击或键盘激活入口才切换内容。
 * 预期结果：图标提供中文名称，入口可通过键盘和路由访问。
 */

import { canAccessModule } from "@leonwillow-electron/access";
import { buttonVariants } from "@leonwillow-electron/ui/components/button";
import { HoverCardTrigger } from "@leonwillow-electron/ui/components/hover-card";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
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
import { settingsHomeHref, sidebarNav } from "@/assets/data/navigation";
import AdminMenu from "@/components/layout/admin-menu";
import AppLogo from "@/components/layout/app-logo";
import CommandMenu from "@/components/layout/command-menu";
import ModeToggle from "@/components/layout/mode-toggle";
import ProfileMenu from "@/components/layout/profile-menu";
import ThemeCustomizer from "@/components/layout/theme-customizer";
import { isWorkspaceMenuId } from "@/lib/workspace-menu-state";
import FullscreenToggle from "./fullscreen-toggle";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

const isActive = (pathname: string, href: string) =>
	pathname === href || pathname.startsWith(`${href}/`);

const AppSidebar = () => {
	const menu = useWorkspaceNavigation();
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const pathname = useLocation({ select: (location) => location.pathname });
	const { caseId, typeId, inquiryCaseId, recordId, inquiryView } = useSearch({
		strict: false,
	});
	const settingsActive = [settingsHomeHref, "/settings/notifications"].includes(
		pathname,
	);
	const enterItem = (id: string) => {
		menu.preview(isWorkspaceMenuId(id) ? id : null);
	};

	return (
		<ScrollArea
			className="workspace-rail w-workspace-rail shrink-0 border-r bg-sidebar"
			contentClassName="flex flex-col items-center"
			render={<aside />}
		>
			<div
				data-slot="workspace-header"
				className="flex h-workspace-header w-full shrink-0 items-center justify-center border-border border-b"
			>
				<AppLogo variant="rail" />
			</div>

			<nav
				aria-label="主导航"
				className="workspace-rail-group w-full flex-1"
				ref={menu.navigationRef}
			>
				{sidebarNav
					.filter((item) =>
						canAccessModule({ role: user.role, moduleIds }, item.id),
					)
					.map((item) => {
						const active = isActive(pathname, item.href);
						const menuId = isWorkspaceMenuId(item.id) ? item.id : null;
						const expanded =
							!!menuId && menu.visible && menu.activeMenu === menuId;
						const link = (
							<Link
								ref={menuId ? menu.triggerRefs[menuId] : undefined}
								aria-controls={menuId ? "workspace-menu" : undefined}
								aria-expanded={menuId ? expanded : undefined}
								onPointerEnter={menuId ? undefined : () => enterItem(item.id)}
								onFocus={menuId ? undefined : () => enterItem(item.id)}
								onClick={menuId ? () => menu.show(menuId) : undefined}
								onKeyDown={
									menuId
										? (event) => {
												if (
													(!menu.pinned || menu.activeMenu === menuId) &&
													(event.key === "ArrowRight" ||
														(event.key === "Tab" &&
															!event.shiftKey &&
															expanded))
												) {
													event.preventDefault();
													menu.focusPanel(menuId);
												}
											}
										: undefined
								}
								to={item.href}
								activeOptions={{ exact: false }}
								search={
									item.id === "funds"
										? { caseId }
										: item.id === "documents"
											? { typeId }
											: item.id === "inquiries"
												? { inquiryCaseId, recordId, inquiryView }
												: undefined
								}
								aria-label={item.title}
								aria-current={active ? "page" : undefined}
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "icon-workspace",
									}),
									"workspace-nav-item",
								)}
							>
								<item.icon />
							</Link>
						);
						return menuId ? (
							<Tooltip key={item.href} disabled={!menu.pinned}>
								<TooltipTrigger
									render={
										<HoverCardTrigger
											id={`workspace-trigger-${menuId}`}
											data-menu-trigger={menuId}
											handle={menu.hoverHandle}
											payload={menuId}
											delay={150}
											closeDelay={180}
											render={link}
										/>
									}
								/>
								<TooltipContent side="right">{item.title}</TooltipContent>
							</Tooltip>
						) : (
							<Tooltip key={item.href}>
								<TooltipTrigger render={link} />
								<TooltipContent side="right">{item.title}</TooltipContent>
							</Tooltip>
						);
					})}
			</nav>

			<div className="workspace-rail-group w-full">
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
										size: "icon-workspace",
									}),
									"workspace-nav-item",
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
				<FullscreenToggle />
				<ProfileMenu />
			</div>
		</ScrollArea>
	);
};

export default AppSidebar;
