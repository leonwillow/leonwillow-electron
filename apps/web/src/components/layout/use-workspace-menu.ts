/**
 * @file 工作台唯一二级菜单框的悬停、固定及焦点控制器。
 * 创建时间：2026-10-13；修改时间：2026-11-05。
 * 版本作用：只由工作台 Provider 创建一次，模块切换只替换 activeMenu。
 * 被调用：WorkspaceNavigationProvider；调用：共享状态转换、React、路由及浏览器事件。
 * 功能与预期结果：共享固定和展开状态；固定时忽略导航预览，点击切换，窄窗仍可临时收起。
 */
import { createHoverCardHandle } from "@leonwillow-electron/ui/components/hover-card";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useReducer, useRef, useState } from "react";
import {
	initialWorkspaceMenuState,
	readWorkspaceMenuPinned,
	type WorkspaceMenuId,
	workspaceMenuForPath,
	workspaceMenuReducer,
	workspaceMenuStorageKey,
	writeWorkspaceMenuPinned,
} from "@/lib/workspace-menu-state";
import { useWorkspaceMenuWidth } from "./use-workspace-menu-width";

/** Provider 按用户隔离生命周期；卸载时清理窗口监听和待执行焦点操作。 */
export function useWorkspaceMenu({
	userId,
	enabledMenus,
}: {
	userId: string;
	enabledMenus: readonly WorkspaceMenuId[];
}) {
	const menuWidth = useWorkspaceMenuWidth(userId);
	const pathname = useLocation({ select: (location) => location.pathname });
	const pathMenu = workspaceMenuForPath(pathname);
	const routeMenu =
		pathMenu && enabledMenus.includes(pathMenu) ? pathMenu : null;
	const [state, dispatch] = useReducer(
		workspaceMenuReducer,
		{ userId, routeMenu },
		(initial) =>
			initialWorkspaceMenuState(
				initial.routeMenu,
				readWorkspaceMenuPinned(initial.userId),
			),
	);
	const [wide, setWide] = useState(
		() => window.matchMedia("(min-width: 48rem)").matches,
	);
	const fundsTrigger = useRef<HTMLAnchorElement>(null);
	const documentsTrigger = useRef<HTMLAnchorElement>(null);
	const inquiriesTrigger = useRef<HTMLAnchorElement>(null);
	const calculatorsTrigger = useRef<HTMLAnchorElement>(null);
	const triggerRefs = {
		funds: fundsTrigger,
		documents: documentsTrigger,
		inquiries: inquiriesTrigger,
		calculators: calculatorsTrigger,
	};
	const navigationRef = useRef<HTMLElement>(null);
	const panelRef = useRef<HTMLElement>(null);
	const dragging = useRef(false);
	const [hoverHandle] = useState(() =>
		createHoverCardHandle<WorkspaceMenuId>(),
	);
	const focusFrame = useRef<number | null>(null);
	const activeMenu =
		state.activeMenu && enabledMenus.includes(state.activeMenu)
			? state.activeMenu
			: null;
	const docked = !!activeMenu && state.pinned && wide;
	const visible = !!activeMenu && (docked || state.open);
	const show = (menuId: WorkspaceMenuId | null = activeMenu) => {
		if (!menuId || !enabledMenus.includes(menuId)) return;
		dispatch({ type: "show", menuId });
	};
	const dismiss = () => dispatch({ type: "dismiss" });
	// 仅供案件拖放结束收尾；常规悬停路径和延迟关闭交由 HoverCard。
	const scheduleClose = () => {
		if (
			!docked &&
			!dragging.current &&
			!panelRef.current?.matches(":hover") &&
			!navigationRef.current?.matches(":hover")
		)
			dismiss();
	};
	const focusPanel = (menuId: WorkspaceMenuId) => {
		show(menuId);
		if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		focusFrame.current = requestAnimationFrame(() => {
			focusFrame.current = null;
			panelRef.current?.querySelector("input")?.focus();
		});
	};
	const togglePinned = () => {
		const pinned = !state.pinned;
		dispatch({ type: "pin", pinned });
		writeWorkspaceMenuPinned(userId, pinned);
	};
	useEffect(() => {
		dispatch({ type: "route", menuId: routeMenu });
	}, [routeMenu]);
	useEffect(() => {
		writeWorkspaceMenuPinned(userId, readWorkspaceMenuPinned(userId));
		const storageKey = workspaceMenuStorageKey(userId);
		const sync = (event: StorageEvent) => {
			if (event.key === storageKey || event.key === null)
				dispatch({
					type: "sync-pinned",
					pinned: readWorkspaceMenuPinned(userId),
				});
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [userId]);
	useEffect(() => {
		const media = window.matchMedia("(min-width: 48rem)");
		const resize = () => setWide(media.matches);
		media.addEventListener("change", resize);
		return () => media.removeEventListener("change", resize);
	}, []);
	useEffect(
		() => () => {
			if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		},
		[],
	);

	return {
		...menuWidth,
		hoverHandle,
		dragging,
		activeMenu,
		visible,
		pinned: state.pinned,
		docked,
		triggerRefs,
		navigationRef,
		panelRef,
		show,
		preview: (menuId: WorkspaceMenuId | null) => {
			if (menuId && !enabledMenus.includes(menuId)) return;
			dispatch({ type: "preview", menuId });
		},
		scheduleClose,
		dismiss,
		focusPanel,
		togglePinned,
		setDragging: (value: boolean) => {
			dragging.current = value;
		},
	};
}

export type WorkspaceMenuNavigation = ReturnType<typeof useWorkspaceMenu>;
