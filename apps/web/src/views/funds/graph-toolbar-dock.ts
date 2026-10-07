/**
 * @file G6 原生工具栏的停靠与连续折叠动画。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：同一个工具栏、同一个折叠控件；几何变化不重建或重排图谱。
 * 被调用：graph-toolbar-adapter；调用：位置规则、ResizeObserver、CSS 过渡。
 * 功能：缓存几何尺寸，同步实际展开与动画状态，协调控件反馈和提示时机。
 * 预期结果：支持中途反向与减少动态效果；销毁时清理所有监听和计时器。
 */
import {
	type ToolbarLayout,
	toolbarOrientation,
	toolbarPlacement,
} from "@/lib/funds-toolbar-layout";

export type ToolbarDock = ReturnType<typeof attachToolbarDock>;
export type ToolbarDockState = { expanded: boolean; moving: boolean };

/** toggleSlot 为 React 持有的唯一控件；只在实际尺寸变化时测量，悬停仅写缓存目标。 */
export function attachToolbarDock(
	bar: HTMLElement,
	host: HTMLElement,
	toggleSlot: HTMLElement,
	initial: ToolbarLayout,
	onHideHint: () => void,
	onStateChange: (state: ToolbarDockState) => void,
) {
	const body = document.createElement("div");
	body.className = "funds-graph-toolbar-body";
	body.append(...bar.childNodes);
	toggleSlot.className = "funds-graph-toolbar-toggle";
	bar.append(body, toggleSlot);
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
	let layout = initial;
	let peeking = false;
	let pointerInside = false;
	let suppressHover = false;
	let held = false;
	let ready = false;
	let keyboardInteraction = false;
	let destroyed = false;
	let renderedOpen: boolean | undefined;
	let moving = false;
	let focusAfterExpand = false;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let motionTimer: ReturnType<typeof setTimeout> | undefined;
	let measureFrame = 0;
	let initializeFrame = 0;
	let geometry:
		| {
				width: number;
				height: number;
				compactWidth: number;
				compactHeight: number;
				x: number;
				y: number;
				insetLeft: number;
				insetTop: number;
		  }
		| undefined;
	const events = new AbortController();
	const options = { signal: events.signal };
	const isOpen = () =>
		!layout.collapsed || (!suppressHover && (peeking || held));
	const applyGeometry = () => {
		if (!geometry) return;
		const open = isOpen();
		bar.style.width = `${open ? geometry.width : geometry.compactWidth}px`;
		bar.style.height = `${open ? geometry.height : geometry.compactHeight}px`;
		toggleSlot.style.transform = `translate(${open ? geometry.x : geometry.insetLeft}px, ${open ? geometry.y : geometry.insetTop}px)`;
	};
	const finishMotion = () => {
		clearTimeout(motionTimer);
		moving = false;
		bar.dataset.moving = "false";
		body.inert = !isOpen();
		onStateChange({ expanded: isOpen(), moving: false });
		if (focusAfterExpand && isOpen()) {
			body
				.querySelector<HTMLElement>('[tabindex="0"],button:not([disabled])')
				?.focus({ preventScroll: true });
		}
		focusAfterExpand = false;
	};
	const paint = () => {
		const open = isOpen();
		if (open === renderedOpen) return;
		const animate = renderedOpen !== undefined && !reducedMotion.matches;
		renderedOpen = open;
		clearTimeout(motionTimer);
		moving = animate;
		bar.dataset.expanded = String(open);
		bar.dataset.moving = String(animate);
		body.inert = !open || animate;
		body.setAttribute("aria-hidden", String(!open));
		onHideHint();
		onStateChange({ expanded: open, moving: animate });
		applyGeometry();
		if (animate) {
			// CSS 可从当前插值反向；兜底覆盖无尺寸差异时没有 transitionend 的情形。
			motionTimer = setTimeout(finishMotion, open ? 360 : 320);
		} else finishMotion();
	};
	const measure = () => {
		measureFrame = 0;
		if (destroyed) return;
		bar.style.setProperty("--funds-dock-width", `${host.clientWidth}px`);
		bar.style.setProperty("--funds-dock-height", `${host.clientHeight}px`);
		const style = getComputedStyle(bar);
		const left = Number.parseFloat(style.paddingLeft);
		const right = Number.parseFloat(style.paddingRight);
		const top = Number.parseFloat(style.paddingTop);
		const bottom = Number.parseFloat(style.paddingBottom);
		const borderX =
			Number.parseFloat(style.borderLeftWidth) +
			Number.parseFloat(style.borderRightWidth);
		const borderY =
			Number.parseFloat(style.borderTopWidth) +
			Number.parseFloat(style.borderBottomWidth);
		const width = body.offsetWidth + left + right + borderX;
		const height = body.offsetHeight + top + bottom + borderY;
		const controlWidth = toggleSlot.offsetWidth;
		const controlHeight = toggleSlot.offsetHeight;
		const vertical = toolbarOrientation(layout) === "vertical";
		geometry = {
			width,
			height,
			compactWidth: controlWidth + left + right + borderX,
			compactHeight: controlHeight + top + bottom + borderY,
			insetLeft: left,
			insetTop: top,
			x: vertical
				? (width - borderX - controlWidth) / 2
				: width - borderX - right - controlWidth,
			y: vertical
				? height - borderY - bottom - controlHeight
				: (height - borderY - controlHeight) / 2,
		};
		applyGeometry();
	};
	const requestMeasure = () => {
		if (!measureFrame) measureFrame = requestAnimationFrame(measure);
	};
	const keepFocus = () => {
		const active = document.activeElement;
		return (
			active instanceof HTMLElement &&
			body.contains(active) &&
			(active.matches(":focus-visible") || active.matches("input,textarea"))
		);
	};
	const scheduleClose = () => {
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => {
			if (!pointerInside && !held && !keepFocus()) {
				peeking = false;
				paint();
			}
		}, 180);
	};
	const update = (next: ToolbarLayout) => {
		const folding = next.collapsed && !layout.collapsed;
		focusAfterExpand =
			!next.collapsed &&
			layout.collapsed &&
			toggleSlot.contains(document.activeElement) &&
			keyboardInteraction;
		layout = next;
		const { x, y } = toolbarPlacement(layout);
		bar.dataset.orientation = toolbarOrientation(layout);
		bar.dataset.dockX = x;
		bar.dataset.dockY = y;
		Object.assign(bar.style, {
			top: y === "top" ? "0.5rem" : y === "middle" ? "50%" : "auto",
			bottom: y === "bottom" ? "0.5rem" : "auto",
			left: x === "left" ? "0.5rem" : x === "center" ? "50%" : "auto",
			right: x === "right" ? "0.5rem" : "auto",
			transform: `translate(${x === "center" ? "-50%" : "0"}, ${y === "middle" ? "-50%" : "0"})`,
		});
		if (folding) {
			peeking = false;
			suppressHover = true;
			const active = document.activeElement;
			if (active instanceof HTMLElement && body.contains(active)) {
				if (keyboardInteraction || active.matches(":focus-visible"))
					toggleSlot.querySelector("button")?.focus({ preventScroll: true });
				else active.blur();
			}
		}
		measure();
		paint();
		if (!moving && focusAfterExpand) finishMotion();
	};
	bar.addEventListener(
		"pointerenter",
		(event) => {
			if (event.pointerType === "touch") return;
			pointerInside = true;
			clearTimeout(closeTimer);
			if (ready && layout.collapsed && !suppressHover) {
				peeking = true;
				paint();
			}
		},
		options,
	);
	bar.addEventListener(
		"pointerleave",
		() => {
			pointerInside = false;
			suppressHover = false;
			scheduleClose();
		},
		options,
	);
	bar.addEventListener("focusout", scheduleClose, options);
	bar.addEventListener(
		"pointerdown",
		() => {
			keyboardInteraction = false;
		},
		options,
	);
	bar.addEventListener(
		"keydown",
		(event) => {
			keyboardInteraction = true;
			if (event.key === "Escape" && layout.collapsed && !held) {
				peeking = false;
				suppressHover = true;
				toggleSlot.querySelector("button")?.focus({ preventScroll: true });
				paint();
			}
		},
		options,
	);
	bar.addEventListener(
		"transitionend",
		(event) => {
			if (
				moving &&
				event.target === bar &&
				["width", "height"].includes(event.propertyName)
			)
				finishMotion();
		},
		options,
	);
	reducedMotion.addEventListener(
		"change",
		() => {
			if (moving) finishMotion();
		},
		options,
	);
	const observer = new ResizeObserver(requestMeasure);
	observer.observe(host);
	observer.observe(body);
	observer.observe(toggleSlot);
	update(initial);
	initializeFrame = requestAnimationFrame(() => {
		bar.dataset.initialized = "true";
	});
	return {
		update,
		setReady(value: boolean) {
			ready = value;
		},
		setHeld(value: boolean) {
			if (held === value) return;
			held = value;
			if (held) clearTimeout(closeTimer);
			else scheduleClose();
			paint();
		},
		destroy() {
			destroyed = true;
			clearTimeout(closeTimer);
			clearTimeout(motionTimer);
			cancelAnimationFrame(measureFrame);
			cancelAnimationFrame(initializeFrame);
			events.abort();
			observer.disconnect();
			onStateChange({ expanded: false, moving: false });
			toggleSlot.remove();
		},
	};
}
