/**
 * @file 案件内图谱视图历史的不可变状态操作。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：保存分析条件和画布快照，不执行数据撤销或服务端写入。
 * 被调用：use-graph-history、graph-canvas 与测试。
 * 预期结果：前进后退正确恢复；返回后新操作丢弃前进分支，最多保留 50 步。
 */
export type CanvasSnapshot = {
	zoom: number;
	position: [number, number];
	nodes: { id: string; x: number; y: number }[];
};
export type ViewFrame<T> = { id: number; state: T; canvas?: CanvasSnapshot };
export type ViewHistory<T> = {
	frames: ViewFrame<T>[];
	index: number;
	serial: number;
};
export function createViewHistory<T>(state: T): ViewHistory<T> {
	return { frames: [{ id: 0, state }], index: 0, serial: 0 };
}
export function pushView<T>(
	history: ViewHistory<T>,
	state: T,
	currentCanvas?: CanvasSnapshot,
	nextCanvas?: CanvasSnapshot,
): ViewHistory<T> {
	const frames = history.frames.slice(0, history.index + 1);
	const current = frames[history.index];
	if (current)
		frames[history.index] = {
			...current,
			canvas: currentCanvas ?? current.canvas,
		};
	frames.push({ id: history.serial + 1, state, canvas: nextCanvas });
	const kept = frames.slice(-50);
	return { frames: kept, index: kept.length - 1, serial: history.serial + 1 };
}
export function moveView<T>(
	history: ViewHistory<T>,
	direction: -1 | 1,
	canvas?: CanvasSnapshot,
): ViewHistory<T> {
	const index = history.index + direction;
	if (index < 0 || index >= history.frames.length) return history;
	return {
		...history,
		index,
		frames: history.frames.map((frame, i) =>
			i === history.index
				? { ...frame, canvas: canvas ?? frame.canvas }
				: frame,
		),
	};
}
