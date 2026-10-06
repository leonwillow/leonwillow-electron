/**
 * @file 分析条件与 G6 画布历史的 React 适配。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：一次明确操作记录一帧，输入草稿和单次滚轮不创建历史。
 * 被调用：analysis-panel；调用：funds-view-history。
 * 预期结果：离开当前视图时捕获位置，切换案件或数据版本后历史重置。
 */
import { useRef, useState } from "react";
import {
	createViewHistory,
	moveView,
	pushView,
} from "@/lib/funds-view-history";
import type { GraphCanvasHandle } from "./graph-canvas";

export function useGraphHistory<T>(initial: T) {
	const canvas = useRef<GraphCanvasHandle>(null);
	const [history, setHistory] = useState(() => createViewHistory(initial));
	const frame = history.frames[history.index];
	if (!frame) throw new Error("图谱历史状态缺失");
	return {
		canvas,
		frame,
		canBack: history.index > 0,
		canForward: history.index < history.frames.length - 1,
		replace: (state: T) =>
			setHistory((h) => ({
				...h,
				frames: h.frames.map((f, i) => (i === h.index ? { ...f, state } : f)),
			})),
		push: (state: T, preserveCanvas = false) => {
			const snapshot = canvas.current?.capture();
			setHistory((h) =>
				pushView(h, state, snapshot, preserveCanvas ? snapshot : undefined),
			);
		},
		move: (direction: -1 | 1) => {
			const snapshot = canvas.current?.capture();
			const next = moveView(history, direction, snapshot);
			setHistory(next);
			return next.frames[next.index]?.state ?? frame.state;
		},
	};
}
