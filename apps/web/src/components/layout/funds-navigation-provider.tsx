/**
 * @file 资金分析案件菜单的展开、固定与焦点协调。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：连接主图标栏与二级案件栏，不保存案件业务资料。
 * 被调用：WorkspaceLayout；调用：React、TanStack Router、浏览器偏好存储。
 * 功能：管理悬停关闭延迟、键盘进出、按用户保存固定状态及路由退出。
 * 预期结果：固定菜单只在资金模块常驻，浮动菜单可移入操作且能明确关闭。
 */
import { useLocation } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	type RefObject,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

type FundsNavigation = {
	visible: boolean;
	pinned: boolean;
	docked: boolean;
	triggerRef: RefObject<HTMLAnchorElement | null>;
	panelRef: RefObject<HTMLElement | null>;
	show: () => void;
	scheduleClose: () => void;
	dismiss: () => void;
	focusPanel: () => void;
	togglePinned: () => void;
	setDragging: (dragging: boolean) => void;
};
const FundsNavigationContext = createContext<FundsNavigation | null>(null);

/** 偏好仅存固定开关；禁用或损坏的存储回退为浮动模式。 */
function readPinned(key: string) {
	try {
		return localStorage.getItem(key) === "true";
	} catch {
		return false;
	}
}

export function FundsNavigationProvider({
	userId,
	children,
}: {
	userId: string;
	children: ReactNode;
}) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const inFunds = pathname === "/funds" || pathname.startsWith("/funds/");
	const storageKey = `funds-case-menu:v1:${userId}`;
	const [pinned, setPinned] = useState(() => readPinned(storageKey));
	const [open, setOpen] = useState(inFunds);
	const [wide, setWide] = useState(
		() => window.matchMedia("(min-width: 48rem)").matches,
	);
	const triggerRef = useRef<HTMLAnchorElement>(null);
	const panelRef = useRef<HTMLElement>(null);
	const dragging = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const docked = pinned && inFunds && wide;
	const visible = docked || open;
	const cancelClose = () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
	};
	const show = () => {
		cancelClose();
		setOpen(true);
	};
	const dismiss = () => {
		cancelClose();
		setOpen(false);
	};
	const scheduleClose = () => {
		cancelClose();
		if (docked || dragging.current) return;
		timer.current = setTimeout(() => {
			const focused = document.activeElement;
			if (
				dragging.current ||
				panelRef.current?.matches(":hover") ||
				triggerRef.current?.matches(":hover") ||
				(focused?.matches(":focus-visible") &&
					(panelRef.current?.contains(focused) ||
						focused === triggerRef.current))
			)
				return;
			setOpen(false);
		}, 180);
	};
	const focusPanel = () => {
		show();
		requestAnimationFrame(() =>
			panelRef.current?.querySelector("input")?.focus(),
		);
	};
	const togglePinned = () => {
		const next = !pinned;
		setPinned(next);
		show();
		try {
			localStorage.setItem(storageKey, String(next));
		} catch {
			// 浏览器不允许存储时仍保留本次会话的操作结果。
		}
	};
	useEffect(() => {
		setOpen(inFunds);
	}, [inFunds]);
	useEffect(() => {
		const media = window.matchMedia("(min-width: 48rem)");
		const resize = () => setWide(media.matches);
		media.addEventListener("change", resize);
		return () => media.removeEventListener("change", resize);
	}, []);
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);
	useEffect(() => {
		const sync = (event: StorageEvent) => {
			if (event.key === storageKey || event.key === null)
				setPinned(readPinned(storageKey));
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [storageKey]);
	useEffect(() => {
		if (!visible || docked) return;
		const outside = (event: PointerEvent) => {
			if (!(event.target instanceof Node)) return;
			if (
				!panelRef.current?.contains(event.target) &&
				!triggerRef.current?.contains(event.target)
			)
				setOpen(false);
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (panelRef.current?.contains(document.activeElement))
				triggerRef.current?.focus();
			setOpen(false);
		};
		document.addEventListener("pointerdown", outside);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("pointerdown", outside);
			document.removeEventListener("keydown", onEscape);
		};
	}, [visible, docked]);
	return (
		<FundsNavigationContext
			value={{
				visible,
				pinned,
				docked,
				triggerRef,
				panelRef,
				show,
				scheduleClose,
				dismiss,
				focusPanel,
				togglePinned,
				setDragging: (value) => {
					dragging.current = value;
					if (value) cancelClose();
				},
			}}
		>
			{children}
		</FundsNavigationContext>
	);
}

export function useFundsNavigation() {
	const context = useContext(FundsNavigationContext);
	if (!context) throw new Error("案件菜单必须放在工作台布局中。");
	return context;
}
