/**
 * @file 列拖动的横向边缘滚动与落位反馈。
 * 创建时间：2026-11-06；修改时间：2026-11-08。
 * 版本作用：ReUI 继续负责排序，限制横向自动滚动并衔接浮层落位与列反馈。
 * 被调用：DataGrid；调用：官方 Sortable 生命周期、当前 ScrollArea viewport。
 * 预期结果：拖动不会改变纵向位置，落位高亮跟随稳定列 ID，卸载时清理监听和定时器。
 */
import type { SortableRootProps } from "@leonwillow-electron/ui/components/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridView } from "./view-controller";

export function useColumnDrag<T>(view: GridView<T>) {
	const cleanup = useRef<() => void>(() => {});
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [moved, setMoved] = useState<{ id: string; sequence: number } | null>(
		null,
	);
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
