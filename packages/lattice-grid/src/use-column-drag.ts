/**
 * @file 列拖动的横向边缘滚动与落位反馈。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 版本作用：ReUI 继续负责排序，仅将表格自动滚动限制为横向。
 * 被调用：DataGrid；调用：官方 Sortable 生命周期、当前 ScrollArea viewport。
 * 预期结果：拖动不会改变纵向位置，落位高亮跟随稳定列 ID，卸载时清理监听和定时器。
 */
import type { SortableRootProps } from "@leonwillow-electron/ui/components/sortable";
import { useEffect, useRef, useState } from "react";
import type { GridView } from "./view-controller";

export function useColumnDrag<T>(view: GridView<T>) {
	const cleanup = useRef<() => void>(() => {});
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [moved, setMoved] = useState<{ id: string; sequence: number } | null>(
		null,
	);
	useEffect(
		() => () => {
			cleanup.current();
			clearTimeout(timer.current);
		},
		[],
	);
	const end = () => cleanup.current();
	const start: NonNullable<SortableRootProps<T>["onDragStart"]> = (event) => {
		end();
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
	};
	const highlight = (id: string) => {
		clearTimeout(timer.current);
		setMoved((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
		timer.current = setTimeout(() => setMoved(null), 1100);
	};
	return {
		start,
		end,
		highlight,
		marker: (id: string) =>
			moved?.id === id ? (moved.sequence % 2 ? "odd" : "even") : undefined,
	};
}
