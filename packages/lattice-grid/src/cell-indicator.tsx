/**
 * @file 可编辑网格单元格共用的选中边框。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 版本作用：切换单元格时移动同一边框，滚动和布局变化时立即对齐实际单元格。
 * 被调用：DataGrid；调用：GridView 与已渲染的单元格 DOM，不修改数据或选区。
 * 预期结果：点击或键盘选择后显示边框，悬停不改变选中框，只读格无交互框，冻结边界正确裁剪。
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import type { GridView } from "./view-controller";

export function CellIndicator<T>({ view }: { view: GridView<T> }) {
	const layerRef = useRef<HTMLDivElement>(null);
	const refreshRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		const layer = layerRef.current;
		const border = layer?.firstElementChild as HTMLElement | null;
		const body = layer?.parentElement;
		const viewport = view.scroller;
		if (!layer || !border || !body || !viewport) return;
		let previousTarget = "";
		let previousSelection = "";
		let previousGeometry = "";
		let scrollLeft = viewport.scrollLeft;
		let scrollTop = viewport.scrollTop;

		const update = (animate: boolean, snap = false) => {
			const target = body.querySelector<HTMLElement>(".lg-cell.lg-active");
			if (
				view.getSnapshot().editing ||
				!target ||
				target.getAttribute("aria-readonly") !== "false"
			) {
				layer.hidden = true;
				previousTarget = "";
				return;
			}
			const rect = target.getBoundingClientRect();
			const origin = body.getBoundingClientRect();
			const viewportRect = viewport.getBoundingClientRect();
			const pinned = target.classList.contains("lg-pinned");
			const frozenWidth = view
				.layout()
				.reduce(
					(width, column) => width + (column.pinned ? column.width : 0),
					view.gutterWidth(),
				);
			// 冻结列和表头始终盖住滚动内容，边框也使用同样的可视边界。
			const left =
				viewportRect.left + (pinned ? view.gutterWidth() : frozenWidth);
			const top = viewportRect.top + view.headHeight();
			const right = viewportRect.left + viewport.clientWidth;
			const bottom =
				viewportRect.top + viewport.clientHeight - view.summaryHeight();
			if (
				rect.right <= left ||
				rect.left >= right ||
				rect.bottom <= top ||
				rect.top >= bottom
			) {
				layer.hidden = true;
				previousTarget = "";
				return;
			}
			layer.style.clipPath = `inset(${Math.max(0, top - origin.top)}px ${Math.max(0, origin.right - right)}px ${Math.max(0, origin.bottom - bottom)}px ${Math.max(0, left - origin.left)}px)`;
			const x = rect.left - origin.left;
			const y = rect.top - origin.top;
			const geometry = `${x},${y},${rect.width},${rect.height}`;
			const changed = previousTarget !== target.id;
			if (snap || changed || geometry !== previousGeometry) {
				border.dataset.animate = String(animate && changed && !!previousTarget);
				border.style.transform = `translate(${x}px, ${y}px)`;
				// 四条固定厚度的边只沿自身长度缩放，不逐帧改变布局尺寸。
				border.style.setProperty("--lg-cell-width", String(rect.width));
				border.style.setProperty("--lg-cell-height", String(rect.height));
			}
			layer.hidden = false;
			previousTarget = target.id;
			previousGeometry = geometry;
		};
		const scroll = () => {
			if (
				viewport.scrollLeft === scrollLeft &&
				viewport.scrollTop === scrollTop
			)
				return;
			scrollLeft = viewport.scrollLeft;
			scrollTop = viewport.scrollTop;
			// 滚动只对齐当前选中格，不播放位移动画。
			update(false, true);
		};
		refreshRef.current = () => {
			const focus = view.store.getSnapshot().state.selection?.focus;
			const selection = JSON.stringify(focus);
			const changed = selection !== previousSelection;
			previousSelection = selection;
			update(changed);
		};
		refreshRef.current();
		const resizeObserver = new ResizeObserver(() => update(false, true));
		resizeObserver.observe(viewport);
		resizeObserver.observe(body);
		viewport.addEventListener("scroll", scroll, { passive: true });
		return () => {
			refreshRef.current = null;
			resizeObserver.disconnect();
			viewport.removeEventListener("scroll", scroll);
		};
	}, [view]);

	// React 提交虚拟行、权限和列尺寸后读取最新 DOM；不订阅逐帧指针坐标。
	useLayoutEffect(() => refreshRef.current?.());
	return (
		<div ref={layerRef} className="lg-cell-indicator-clip" aria-hidden hidden>
			<div className="lg-cell-indicator">
				<span className="lg-cell-indicator-edge" data-edge="top" />
				<span className="lg-cell-indicator-edge" data-edge="bottom" />
				<span className="lg-cell-indicator-edge" data-edge="left" />
				<span className="lg-cell-indicator-edge" data-edge="right" />
			</div>
		</div>
	);
}
