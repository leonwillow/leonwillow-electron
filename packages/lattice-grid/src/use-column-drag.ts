/**
 * @file 列拖动的横向边缘滚动与落位反馈。
 * 创建时间：2026-11-06；修改时间：2026-11-17。
 * 版本作用：ReUI 继续负责排序，限制横向自动滚动并由独立装饰层衔接整列落位反馈。
 * 被调用：DataGrid；调用：官方 Sortable 生命周期、当前 ScrollArea viewport。
 * 预期结果：拖动不会改变纵向位置，落位高亮跟随稳定列 ID，卸载时清理监听和定时器。
 */
import type { SortableRootProps } from "@leonwillow-electron/ui/components/sortable";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { GridView } from "./view-controller";

/** 以当前视图提供排序回调；本 hook 拥有临时光带及监听，无滚动口时跳过装饰。 */
export function useColumnDrag<T>(view: GridView<T>) {
	const cleanup = useRef<() => void>(() => {});
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [moved, setMoved] = useState<{ id: string; sequence: number } | null>(
		null,
	);
	useLayoutEffect(() => {
		const viewport = view.scroller;
		const host = viewport?.parentElement;
		const win = viewport?.ownerDocument.defaultView;
		if (!moved || !viewport || !host || !win) return;

		const layer = viewport.ownerDocument.createElement("div");
		layer.className = "lg-column-highlight";
		layer.setAttribute("aria-hidden", "true");
		const update = () => {
			const layout = view.layout(viewport.clientWidth);
			const column = layout.find((item) => item.column.id === moved.id);
			if (!column) {
				layer.style.visibility = "hidden";
				return;
			}
			const gutter = view.gutterWidth();
			const frozenEdge = layout.reduce(
				(left, item) => left + (item.pinned ? item.width : 0),
				gutter,
			);
			const columnLeft = column.pinned
				? column.pinLeft
				: column.left - viewport.scrollLeft;
			const left = Math.max(columnLeft, column.pinned ? gutter : frozenEdge);
			const right = Math.min(columnLeft + column.width, viewport.clientWidth);
			const viewportRect = viewport.getBoundingClientRect();
			const hostRect = host.getBoundingClientRect();
			Object.assign(layer.style, {
				left: `${viewportRect.left + viewport.clientLeft - hostRect.left - host.clientLeft + left}px`,
				top: `${viewportRect.top + viewport.clientTop - hostRect.top - host.clientTop}px`,
				width: `${Math.max(0, right - left)}px`,
				height: `${viewport.clientHeight}px`,
				visibility: right > left && viewport.clientHeight > 0 ? "" : "hidden",
			});
		};
		update();
		// 挂在滚动口之外，贯穿吸附表头、虚拟正文及汇总，不随虚拟行重播动画。
		host.append(layer);
		viewport.addEventListener("scroll", update, { passive: true });
		const observer = new win.ResizeObserver(update);
		observer.observe(viewport);
		observer.observe(host);
		const unsubscribeView = view.subscribe(update);
		const unsubscribeStore = view.store.subscribe(update);
		return () => {
			viewport.removeEventListener("scroll", update);
			observer.disconnect();
			unsubscribeView();
			unsubscribeStore();
			layer.remove();
		};
	}, [view, moved]);
	const dropAnimation = useMemo<SortableRootProps<T>["dropAnimation"]>(
		() => ({
			get duration() {
				const viewport = view.scroller;
				const win = viewport?.ownerDocument.defaultView;
				if (win?.matchMedia("(prefers-reduced-motion: reduce)").matches)
					return 0;
				return viewport && win
					? Number.parseFloat(
							win
								.getComputedStyle(viewport)
								.getPropertyValue("--lg-column-drop-ms"),
						) || 320
					: 320;
			},
			easing: "cubic-bezier(0.16, 1, 0.3, 1)",
			sideEffects({ active, dragOverlay }) {
				// 仅隐藏原表头内容，保留整列底色和冻结遮挡；位置动画仍由 dnd-kit 计算。
				active.node.setAttribute("data-column-drop-target", "");
				dragOverlay.node.setAttribute("data-column-dropping", "");
				return () => {
					active.node.removeAttribute("data-column-drop-target");
					dragOverlay.node.removeAttribute("data-column-dropping");
				};
			},
		}),
		[view],
	);
	useEffect(
		() => () => {
			cleanup.current();
			clearTimeout(timer.current);
		},
		[],
	);
	const highlight = useCallback((id: string) => {
		clearTimeout(timer.current);
		setMoved((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
		timer.current = setTimeout(() => setMoved(null), 1100);
	}, []);
	const end = useCallback<NonNullable<SortableRootProps<T>["onDragEnd"]>>(
		(event) => {
			cleanup.current();
			// 回到原位或 Escape 取消也需要衔接浮层，且不会因此提交新的列顺序。
			highlight(String(event.active.id));
		},
		[highlight],
	);
	const start = useCallback<NonNullable<SortableRootProps<T>["onDragStart"]>>(
		(event) => {
			cleanup.current();
			clearTimeout(timer.current);
			setMoved(null);
			const viewport = view.scroller;
			const win = viewport?.ownerDocument.defaultView;
			if (!viewport || !win || !(event.activatorEvent instanceof MouseEvent))
				return;
			let x = event.activatorEvent.clientX;
			let frame = 0;
			let lastTime = 0;
			const move = (e: MouseEvent) => {
				x = e.clientX;
			};
			const tick = (time: number) => {
				const rect = viewport.getBoundingClientRect();
				const edge = Math.min(64, rect.width / 5);
				const speed =
					x < rect.left + edge
						? -Math.min(1, (rect.left + edge - x) / edge)
						: x > rect.right - edge
							? Math.min(1, (x - rect.right + edge) / edge)
							: 0;
				if (lastTime && speed)
					viewport.scrollLeft += speed * Math.min(time - lastTime, 32) * 0.7;
				lastTime = time;
				frame = win.requestAnimationFrame(tick);
			};
			viewport.ownerDocument.addEventListener("mousemove", move);
			frame = win.requestAnimationFrame(tick);
			cleanup.current = () => {
				win.cancelAnimationFrame(frame);
				viewport.ownerDocument.removeEventListener("mousemove", move);
			};
		},
		[view],
	);
	return useMemo(
		() => ({
			start,
			end,
			dropAnimation,
			marker: (id: string) =>
				moved?.id === id ? (moved.sequence % 2 ? "odd" : "even") : undefined,
		}),
		[start, end, dropAnimation, moved],
	);
}
