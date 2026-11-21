/**
 * @file 工作台单个二级菜单框的导航上下文。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：在布局中唯一创建菜单状态，模块适配只绑定内容 ID，不创建独立状态。
 * 被调用：WorkspaceLayout、AppSidebar、业务导航与 WorkspaceSecondaryMenu。
 * 调用：useWorkspaceMenu；预期结果：任意模块固定/取消固定后，整个菜单框同步生效。
 */
import { HoverCard } from "@leonwillow-electron/ui/components/hover-card";
import { useLocation } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	isWorkspaceMenuId,
	type WorkspaceMenuId,
} from "@/lib/workspace-menu-state";
import {
	useWorkspaceMenu,
	type WorkspaceMenuNavigation,
} from "./use-workspace-menu";

const Context = createContext<WorkspaceMenuNavigation | null>(null);

export function WorkspaceNavigationProvider({
	userId,
	enabledMenus,
	children,
}: {
	userId: string;
	enabledMenus: readonly WorkspaceMenuId[];
	children: ReactNode;
}) {
	const navigation = useWorkspaceMenu({ userId, enabledMenus });
	return (
		<Context value={navigation}>
			<HoverCard
				handle={navigation.hoverHandle}
				open={navigation.visible && !navigation.docked}
				triggerId={
					navigation.activeMenu
						? `workspace-trigger-${navigation.activeMenu}`
						: null
				}
				onOpenChange={(open, details) => {
					if (navigation.docked) {
						details.cancel();
						return;
					}
					if (open) {
						const menuId = details.trigger?.getAttribute("data-menu-trigger");
						if (
							!menuId ||
							!isWorkspaceMenuId(menuId) ||
							navigation.pinned ||
							(details.reason === "trigger-hover" &&
								!details.trigger?.matches(":hover")) ||
							(details.reason === "trigger-focus" &&
								!details.trigger?.matches(":focus-visible"))
						) {
							details.cancel();
							return;
						}
						navigation.preview(menuId);
					} else {
						if (
							navigation.dragging.current ||
							(details.reason === "trigger-hover" &&
								navigation.panelRef.current?.contains(document.activeElement) &&
								document.activeElement?.matches(
									":focus-visible, input, textarea",
								))
						) {
							details.cancel();
							return;
						}
						if (
							details.reason === "escape-key" &&
							navigation.panelRef.current?.contains(document.activeElement)
						) {
							if (navigation.activeMenu)
								navigation.triggerRefs[navigation.activeMenu].current?.focus();
						}
						navigation.dismiss();
					}
				}}
			>
				{children}
			</HoverCard>
		</Context>
	);
}

export function useWorkspaceNavigation() {
	const context = useContext(Context);
	if (!context) throw new Error("二级菜单必须放在工作台布局中。");
	return context;
}

/** 只绑定模块的打开/聚焦入口；隔离无关模块的 activeMenu 变化，避免悬停侧栏引发全页重渲染。 */
export function useWorkspaceMenuSection(menuId: WorkspaceMenuId) {
	const {
		widthRem,
		setWidthRem,
		hoverHandle,
		dragging,
		activeMenu,
		visible: navVisible,
		pinned,
		docked: navDocked,
		triggerRefs,
		navigationRef,
		panelRef,
		show: navShow,
		preview,
		scheduleClose,
		dismiss,
		focusPanel: navFocusPanel,
		togglePinned,
		setDragging,
	} = useWorkspaceNavigation();
	const visible = navVisible && activeMenu === menuId;
	const docked = navDocked && activeMenu === menuId;
	const show = useCallback(() => navShow(menuId), [navShow, menuId]);
	const focusPanel = useCallback(
		() => navFocusPanel(menuId),
		[navFocusPanel, menuId],
	);
	return useMemo(
		() => ({
			widthRem,
			setWidthRem,
			hoverHandle,
			dragging,
			visible,
			pinned,
			docked,
			triggerRefs,
			navigationRef,
			panelRef,
			show,
			preview,
			scheduleClose,
			dismiss,
			focusPanel,
			togglePinned,
			setDragging,
		}),
		[
			widthRem,
			setWidthRem,
			hoverHandle,
			dragging,
			visible,
			pinned,
			docked,
			triggerRefs,
			navigationRef,
			panelRef,
			show,
			preview,
			scheduleClose,
			dismiss,
			focusPanel,
			togglePinned,
			setDragging,
		],
	);
}

function menuRouteMatches(menuId: WorkspaceMenuId, pathname: string) {
	return pathname === `/${menuId}` || pathname.startsWith(`/${menuId}/`);
}

/**
 * 仅在当前路由属于该模块或用户首次展开/悬停其二级菜单时激活目录请求，
 * 避免登录进入工作台时一次性并发拉取全部无关模块的目录。
 */
export function useWorkspaceMenuActivated(
	menuId: WorkspaceMenuId,
	enabled: boolean,
) {
	const menu = useWorkspaceMenuSection(menuId);
	const routeActive = useLocation({
		select: (location) => menuRouteMatches(menuId, location.pathname),
	});
	const [activated, setActivated] = useState(false);
	const shouldActivate = enabled && (menu.visible || routeActive);
	useEffect(() => {
		if (shouldActivate && !activated) setActivated(true);
	}, [shouldActivate, activated]);
	return enabled && (activated || shouldActivate);
}
