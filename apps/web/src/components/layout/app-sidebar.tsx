/**
 * @file 工作台的主导航侧栏。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/workspace-layout.tsx。
 * 调用：共享 UI、路由、导航目录、工作台统一导航上下文、管理中心、搜索、品牌、主题与个人菜单。
 * 功能：按侧栏可见配置、菜单外观（贴边/宽菜单/悬浮/悬浮时尚）与授权展示入口；宽菜单在贴边基础上横向展开并分组显示标签，未固定时悬停预览二级列表。
 * 预期结果：图标与宽行均具备中文可访问名称，窄窗自动收回紧凑图标栏，入口通过应用内路由跳转且不触发浏览器底部链接预览。
 */

import { canAccessModule } from "@leonwillow-electron/access";
import { Button } from "@leonwillow-electron/ui/components/button";
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
	useLocation,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { sidebarNav } from "@/assets/data/navigation";
import AdminMenu from "@/components/layout/admin-menu";
import AppLogo from "@/components/layout/app-logo";
import CommandMenu from "@/components/layout/command-menu";
import ModeToggle from "@/components/layout/mode-toggle";
import ProfileMenu from "@/components/layout/profile-menu";
import ThemeCustomizer from "@/components/layout/theme-customizer";
import { isWorkspaceMenuId } from "@/lib/workspace-menu-state";
import { useThemeStore } from "@/stores/theme-store";
import FullscreenToggle from "./fullscreen-toggle";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

const isActive = (pathname: string, href: string) =>
	pathname === href || pathname.startsWith(`${href}/`);

const AppSidebar = () => {
	const menu = useWorkspaceNavigation();
	const sidebarMode = useThemeStore(
		(state) => state.preferences.settings.sidebarMode,
	);
	const [wideViewport, setWideViewport] = useState(
		() => window.matchMedia("(min-width: 40rem)").matches,
	);
	useEffect(() => {
		const media = window.matchMedia("(min-width: 40rem)");
		const sync = () => setWideViewport(media.matches);
		media.addEventListener("change", sync);
		return () => media.removeEventListener("change", sync);
	}, []);
	const pillMode = sidebarMode === "floating-pill";
	const wideMode = sidebarMode === "wide" && wideViewport;
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const pathname = useLocation({ select: (location) => location.pathname });
	const navigate = useNavigate();
	const { caseId, typeId, inquiryCaseId, recordId, inquiryView } = useSearch({
		strict: false,
	});
	const visibleNav = sidebarNav.filter((item) =>
		canAccessModule({ role: user.role, moduleIds }, item.id),
	);
	const enterItem = (id: string) => {
		menu.preview(isWorkspaceMenuId(id) ? id : null);
	};

	return (
		<ScrollArea
			className="workspace-rail w-workspace-rail shrink-0 border-r bg-sidebar"
			contentClassName={cn(
				"flex flex-col",
				wideMode ? "items-stretch" : "items-center",
			)}
			render={<aside />}
		>
			<div
				data-slot={pillMode ? undefined : "workspace-header"}
				className={
					pillMode
						? "workspace-rail-pill workspace-rail-group"
						: cn(
								"flex h-workspace-header w-full shrink-0 items-center border-sidebar-border border-b",
								wideMode ? "justify-start px-3" : "justify-center",
							)
				}
			>
				<AppLogo variant="rail" showName={wideMode} />
				{pillMode && <CommandMenu />}
			</div>

			{wideMode && (
				<div className="w-full shrink-0 px-2.5 pt-workspace-gutter pb-1">
					<CommandMenu wide />
				</div>
			)}

			{(!pillMode || visibleNav.length > 0) && (
				<nav
					aria-label="主导航"
					className={cn(
						wideMode
							? "flex w-full flex-1 flex-col items-stretch gap-0.5 px-2.5 py-2"
							: "workspace-rail-group",
						!wideMode && (pillMode ? "workspace-rail-pill" : "w-full flex-1"),
					)}
					ref={menu.navigationRef}
				>
					{wideMode && visibleNav.length > 0 && (
						<p className="px-2.5 pt-1 pb-1.5 font-medium text-caption text-muted-foreground">
							工作台
						</p>
					)}
					{visibleNav.map((item) => {
						const active = isActive(pathname, item.href);
						const menuId = isWorkspaceMenuId(item.id) ? item.id : null;
						const expanded =
							!!menuId && menu.visible && menu.activeMenu === menuId;
						const trigger = (
							<Button
								ref={menuId ? menu.triggerRefs[menuId] : undefined}
								variant="ghost"
								size={wideMode ? "lg" : "icon-workspace"}
								aria-controls={menuId ? "workspace-menu" : undefined}
								aria-expanded={menuId ? expanded : undefined}
								onPointerEnter={menuId ? undefined : () => enterItem(item.id)}
								onFocus={menuId ? undefined : () => enterItem(item.id)}
								onClick={() => {
									if (menuId) menu.show(menuId);
									if (item.id === "funds")
										void navigate({ to: "/funds", search: { caseId } });
									else if (item.id === "documents")
										void navigate({ to: "/documents", search: { typeId } });
									else if (item.id === "inquiries")
										void navigate({
											to: "/inquiries",
											search: { inquiryCaseId, recordId, inquiryView },
										});
									else void navigate({ to: item.href });
								}}
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
								aria-label={wideMode ? undefined : item.title}
								aria-current={active ? "page" : undefined}
								className={cn(
									"workspace-nav-item",
									wideMode && "w-full justify-start gap-2.5 px-2.5",
								)}
							>
								<item.icon aria-hidden="true" />
								{wideMode && (
									<>
										<span className="min-w-0 flex-1 truncate text-left">
											{item.title}
										</span>
										{menuId && (
											<ChevronRightIcon
												className="size-3.5 text-muted-foreground/60"
												aria-hidden="true"
											/>
										)}
									</>
								)}
							</Button>
						);
						return menuId ? (
							<Tooltip key={item.href} disabled={wideMode || !menu.pinned}>
								<TooltipTrigger
									render={
										<HoverCardTrigger
											id={`workspace-trigger-${menuId}`}
											data-menu-trigger={menuId}
											handle={menu.hoverHandle}
											payload={menuId}
											delay={150}
											closeDelay={180}
											render={trigger}
										/>
									}
								/>
								<TooltipContent side="right">{item.title}</TooltipContent>
							</Tooltip>
						) : (
							<Tooltip key={item.href} disabled={wideMode}>
								<TooltipTrigger render={trigger} />
								<TooltipContent side="right">{item.title}</TooltipContent>
							</Tooltip>
						);
					})}
				</nav>
			)}

			<div
				className={cn(
					wideMode
						? "flex w-full shrink-0 flex-col items-stretch gap-0.5 border-sidebar-border border-t px-2.5 py-2"
						: "workspace-rail-group",
					!wideMode && (pillMode ? "workspace-rail-pill" : "w-full"),
				)}
			>
				{wideMode && (
					<p className="px-2.5 pt-0.5 pb-1 font-medium text-caption text-muted-foreground">
						系统
					</p>
				)}
				{!pillMode && !wideMode && <CommandMenu />}
				<AdminMenu wide={wideMode} />
				<ThemeCustomizer wide={wideMode} />
				<ModeToggle wide={wideMode} />
				<FullscreenToggle wide={wideMode} />
				{wideMode && (
					<div
						className="my-1 h-(--ui-border-width) bg-sidebar-border"
						aria-hidden="true"
					/>
				)}
				<ProfileMenu wide={wideMode} />
			</div>
		</ScrollArea>
	);
};

export default AppSidebar;
