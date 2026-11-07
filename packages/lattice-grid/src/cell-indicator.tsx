/**
 * @file 可编辑网格单元格共用的选中边框。
 * 创建时间：2026-11-06；修改时间：2026-11-07。
 * 版本作用：边框通过 Portal 挂到当前单元格，原生跟随滚动、冻结及布局变化。
 * 被调用：DataGrid；调用：GridView、React Portal 与 Web Animations，不修改数据或选区。
 * 预期结果：仅点击或键盘切换时播放位移动画，滚动不追踪坐标，边框沿用所在单元格的层级。
 */
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GridView } from "./view-controller";

/** 正文的行号/冻结分界；单元格自然滚动坐标不包含可见性裁剪。 */
function cellClipLeft<T>(view: GridView<T>, cell: HTMLElement) {
	const viewport = view.scroller;
	if (!viewport) return 0;
	const frozenWidth = view
		.layout()
		.reduce(
			(width, column) => width + (column.pinned ? column.width : 0),
			view.gutterWidth(),
		);
	return (
		viewport.getBoundingClientRect().left +
		(cell.classList.contains("lg-pinned") ? view.gutterWidth() : frozenWidth)
	);
}

export function CellIndicator<T>({ view }: { view: GridView<T> }) {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const borderRef = useRef<HTMLDivElement>(null);
	const motionRef = useRef<{
		border: HTMLElement;
		clip: HTMLElement;
	} | null>(null);
	const previousSelection = useRef("");
	const originRef = useRef<{ rect: DOMRect; clipLeft: number } | null>(null);

	// 虚拟行提交后解析真实单元格；只在挂载目标改变时更新 Portal。
	useLayoutEffect(() => {
		const viewport = view.scroller;
		const focus = view.store.getSnapshot().state.selection?.focus;
		const selection = JSON.stringify(focus);
		const changed = previousSelection.current !== selection;
		previousSelection.current = selection;
		const target = view.getSnapshot().editing
			? null
			: (viewport?.querySelector<HTMLElement>(
					'.lg-cell.lg-active[aria-readonly="false"]',
				) ?? null);
		if (target === anchor) return;

		originRef.current = null;
		const visual = motionRef.current?.border ?? borderRef.current;
		if (changed && anchor?.isConnected && visual && viewport) {
			// 读取正在播放的四条边，连续点击时从当前视觉位置继续过渡。
			const edges = Array.from(visual.children, (edge) =>
				edge.getBoundingClientRect(),
			);
			const left = Math.min(...edges.map((edge) => edge.left));
			const top = Math.min(...edges.map((edge) => edge.top));
			const right = Math.max(...edges.map((edge) => edge.right));
			const bottom = Math.max(...edges.map((edge) => edge.bottom));
			const clip = viewport.getBoundingClientRect();
			const visibleLeft =
				motionRef.current?.clip.getBoundingClientRect().left ??
				cellClipLeft(view, anchor);
			if (
				right > visibleLeft &&
				left < clip.left + viewport.clientWidth &&
				bottom > clip.top + view.headHeight() &&
				top < clip.top + viewport.clientHeight - view.summaryHeight()
			) {
				originRef.current = {
					rect: new DOMRect(left, top, right - left, bottom - top),
					clipLeft: visibleLeft,
				};
			}
		}
		setAnchor(target);
	});

	useLayoutEffect(() => {
		const border = borderRef.current;
		const viewport = view.scroller;
		const origin = originRef.current;
		originRef.current = null;
		const host = viewport?.parentElement;
		if (!anchor || !border || !viewport || !host || !origin) return;
		const motion = matchMedia("(prefers-reduced-motion: reduce)");
		if (motion.matches) return;
		const from = origin.rect;
		const to = border.getBoundingClientRect();
		if (to.width <= 0 || to.height <= 0) return;

		// 跨冻结区时边框与裁剪边界一起过渡，终点只呈现目标格实际可见的部分。
		// 真实边框仍留在目标格，滚动或动画全部结束时无缝接回。
		const viewportRect = viewport.getBoundingClientRect();
		const hostRect = host.getBoundingClientRect();
		const left = viewportRect.left + view.gutterWidth();
		const top = viewportRect.top + view.headHeight();
		const targetClipLeft = cellClipLeft(view, anchor);
		const layer = document.createElement("div");
		layer.className = "lg-cell-transition";
		layer.setAttribute("aria-hidden", "true");
		Object.assign(layer.style, {
			left: `${left - hostRect.left}px`,
			top: `${top - hostRect.top}px`,
			width: `${Math.max(0, viewport.clientWidth - view.gutterWidth())}px`,
			height: `${Math.max(0, viewport.clientHeight - view.headHeight() - view.summaryHeight())}px`,
		});
		const clip = document.createElement("div");
		clip.className = "lg-cell-transition-clip";
		clip.style.transform = `translateX(${targetClipLeft - left}px)`;
		const movingBorder = border.cloneNode(true) as HTMLElement;
		Object.assign(movingBorder.style, {
			inset: "auto",
			left: `${to.left - targetClipLeft}px`,
			top: `${to.top - top}px`,
			width: `${to.width}px`,
			height: `${to.height}px`,
		});
		clip.append(movingBorder);
		layer.append(clip);
		host.append(layer);
		motionRef.current = { border: movingBorder, clip };
		border.style.visibility = "hidden";

		const animations: Animation[] = [];
		let finished = false;
		const snap = () => {
			if (finished) return;
			finished = true;
			for (const animation of animations) animation.cancel();
			layer.remove();
			border.style.visibility = "";
			motionRef.current = null;
			observer.disconnect();
			viewport.removeEventListener("wheel", snap);
			viewport.removeEventListener("scroll", snap);
			motion.removeEventListener("change", snap);
		};
		const dimensions = () =>
			`${anchor.offsetWidth},${anchor.offsetHeight},${viewport.clientWidth},${viewport.clientHeight}`;
		let previousDimensions = dimensions();
		const observer = new ResizeObserver(() => {
			const next = dimensions();
			if (next !== previousDimensions) snap();
			previousDimensions = next;
		});
		observer.observe(anchor);
		observer.observe(viewport);
		viewport.addEventListener("wheel", snap, { passive: true });
		viewport.addEventListener("scroll", snap, { passive: true });
		motion.addEventListener("change", snap);
		const style = getComputedStyle(border);
		const options: KeyframeAnimationOptions = {
			duration: Number.parseFloat(
				style.getPropertyValue("--lg-cell-indicator-duration"),
			),
			easing: style.getPropertyValue("--lg-cell-indicator-easing").trim(),
			fill: "both",
		};
		const animate = (element: Element, transform: string) => {
			animations.push(
				element.animate([{ transform }, { transform: "none" }], options),
			);
		};
		animations.push(
			clip.animate(
				[
					{ transform: `translateX(${origin.clipLeft - left}px)` },
					{ transform: clip.style.transform },
				],
				options,
			),
		);
		animate(
			movingBorder,
			`translate(${from.left - to.left - (origin.clipLeft - targetClipLeft)}px, ${from.top - to.top}px)`,
		);
		const x = from.width / to.width;
		const y = from.height / to.height;
		const transforms = [
			`scaleX(${x})`,
			`translateY(${from.height - to.height}px) scaleX(${x})`,
			`scaleY(${y})`,
			`translateX(${from.width - to.width}px) scaleY(${y})`,
		];
		Array.from(movingBorder.children).forEach((edge, index) => {
			animate(edge, transforms[index] ?? "none");
		});
		// 同一任务创建的动画交给浏览器在下一绘制帧启动，全部保持终帧后再接回。
		void Promise.all(animations.map((animation) => animation.finished)).then(
			snap,
			() => {},
		);
		return snap;
	}, [anchor, view]);

	return anchor
		? createPortal(
				<div ref={borderRef} className="lg-cell-indicator" aria-hidden>
					<span className="lg-cell-indicator-edge" data-edge="top" />
					<span className="lg-cell-indicator-edge" data-edge="bottom" />
					<span className="lg-cell-indicator-edge" data-edge="left" />
					<span className="lg-cell-indicator-edge" data-edge="right" />
				</div>,
				anchor,
			)
		: null;
}
