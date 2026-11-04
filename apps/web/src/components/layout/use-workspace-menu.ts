/**
 * @file 工作台唯一二级菜单框的悬停、固定及焦点控制器。
 * 创建时间：2026-10-13；修改时间：2026-11-04。
 * 版本作用：只由工作台 Provider 创建一次，模块切换只替换 activeMenu。
 * 被调用：WorkspaceNavigationProvider；调用：共享状态转换、React、路由及浏览器事件。
 * 功能与预期结果：共享固定和展开状态；固定时忽略导航预览，点击切换，窄窗仍可临时收起。
 */
import { useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
	readWorkspaceMenuPinned,
	type WorkspaceMenuId,
	workspaceMenuForPath,
	workspaceMenuReducer,
	workspaceMenuStorageKey,
	writeWorkspaceMenuPinned,
} from "@/lib/workspace-menu-state";
import { useWorkspaceMenuWidth } from "./use-workspace-menu-width";

/** Provider 按用户隔离生命周期；卸载时清理唯一的计时器、窗口监听和待执行焦点操作。 */
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
		(initial) => ({
			activeMenu: initial.routeMenu,
			routeMenu: initial.routeMenu,
			open: initial.routeMenu !== null,
			pinned: readWorkspaceMenuPinned(initial.userId),
		}),
	);
	const [wide, setWide] = useState(
		() => window.matchMedia("(min-width: 48rem)").matches,
	);
	const fundsTrigger = useRef<HTMLAnchorElement>(null);
	const documentsTrigger = useRef<HTMLAnchorElement>(null);
	const inquiriesTrigger = useRef<HTMLAnchorElement>(null);
	const triggerRefs = {
		funds: fundsTrigger,
		documents: documentsTrigger,
		inquiries: inquiriesTrigger,
	};
	const navigationRef = useRef<HTMLElement>(null);
	const panelRef = useRef<HTMLElement>(null);
	const dragging = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusFrame = useRef<number | null>(null);
	const activeMenu =
		state.activeMenu && enabledMenus.includes(state.activeMenu)
			? state.activeMenu
			: null;
	const triggerRef = activeMenu ? triggerRefs[activeMenu] : null;
	const docked = !!activeMenu && state.pinned && wide;
	const visible = !!activeMenu && (docked || state.open);
	const cancelClose = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
	}, []);
	const show = (menuId: WorkspaceMenuId | null = activeMenu) => {
		if (!menuId || !enabledMenus.includes(menuId)) return;
		cancelClose();
		dispatch({ type: "show", menuId });
	};
	const dismiss = () => {
		cancelClose();
		dispatch({ type: "dismiss" });
	};
	const scheduleClose = () => {
		cancelClose();
		if (docked || dragging.current) return;
		timer.current = setTimeout(() => {
			const focused = document.activeElement;
			if (
				dragging.current ||
				panelRef.current?.matches(":hover") ||
				navigationRef.current?.matches(":hover") ||
				triggerRef?.current?.matches(":hover") ||
				(focused?.matches(":focus-visible") &&
					(panelRef.current?.contains(focused) ||
						focused === triggerRef?.current))
			)
				return;
			dispatch({ type: "dismiss" });
		}, 180);
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
		cancelClose();
		dispatch({ type: "pin", pinned });
		writeWorkspaceMenuPinned(userId, pinned);
	};
	useEffect(() => {
		cancelClose();
		dispatch({ type: "route", menuId: routeMenu });
	}, [routeMenu, cancelClose]);
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
			cancelClose();
			if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		},
		[cancelClose],
	);
	useEffect(() => {
		if (!visible || docked) return;
		const outside = (event: PointerEvent) => {
			if (!(event.target instanceof Node)) return;
			if (
				!panelRef.current?.contains(event.target) &&
				!navigationRef.current?.contains(event.target) &&
				!triggerRef?.current?.contains(event.target)
			)
				dispatch({ type: "dismiss" });
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (panelRef.current?.contains(document.activeElement))
				triggerRef?.current?.focus();
			dispatch({ type: "dismiss" });
		};
		document.addEventListener("pointerdown", outside);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("pointerdown", outside);
			document.removeEventListener("keydown", onEscape);
		};
	}, [visible, docked, triggerRef]);
	return {
		...menuWidth,
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
			cancelClose();
			dispatch({ type: "preview", menuId });
		},
		keepOpen: cancelClose,
		scheduleClose,
		dismiss,
		focusPanel,
		togglePinned,
		setDragging: (value: boolean) => {
			dragging.current = value;
			if (value) cancelClose();
		},
	};
}

export type WorkspaceMenuNavigation = ReturnType<typeof useWorkspaceMenu>;
