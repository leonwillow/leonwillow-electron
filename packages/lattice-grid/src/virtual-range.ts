/**
 * @file 固定行高网格的虚拟窗口计算。
 * 创建时间：2026-11-06；修改时间：2026-11-21。
 * 版本作用：小列表常驻，大列表按视口预渲染并保留缓冲；视口缩小或跨过阈值时自动收缩窗口。
 * 被调用：GridView 与回归测试；不依赖 DOM。
 */
export function virtualRange(
	count: number,
	rowHeight: number,
	scrollTop: number,
	visibleHeight: number,
	previous: { start: number; end: number },
	overscan = 8,
	virtualize = true,
) {
	if (!virtualize || count <= 200) return { start: 0, end: count };
	const visible = Math.max(1, Math.ceil(visibleHeight / rowHeight));
	const first = Math.max(
		0,
		Math.min(count - 1, Math.floor(scrollTop / rowHeight)),
	);
	const last = Math.min(count, first + visible + 1);
	const buffer = Math.max(overscan, visible);
	const margin = Math.max(1, Math.floor(buffer / 3));
	const targetStart = Math.max(0, first - buffer);
	const targetEnd = Math.min(count, last + buffer);
	const maxWindow =
		Math.max(targetEnd - targetStart, visible + buffer * 2) + buffer;
	if (
		previous.start <= Math.max(0, first - margin) &&
		previous.end >= Math.min(count, last + margin) &&
		previous.end <= count &&
		previous.end - previous.start <= maxWindow
	)
		return previous;
	return {
		start: targetStart,
		end: targetEnd,
	};
}
