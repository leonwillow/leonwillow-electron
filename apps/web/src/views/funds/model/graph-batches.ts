/**
 * @file 图谱绘制的可取消分批调度。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：根据上一批耗时调整工作量，把执行权交还浏览器处理输入与绘制。
 * 被调用：graph-renderer 与测试；调用：浏览器任务调度、MessageChannel、AbortSignal。
 * 预期结果：数据完整且顺序稳定，离开案件后停止旧批次，绘制失败交由调用方呈现。
 */

/** 让出一个任务；取消也会唤醒等待，避免旧画布继续执行。 */
function yieldToBrowser(signal: AbortSignal) {
	if (signal.aborted) return Promise.resolve();
	const scheduler = (
		globalThis as typeof globalThis & {
			scheduler?: { yield: () => Promise<void> };
		}
	).scheduler;
	if (scheduler?.yield) return scheduler.yield();
	// MessageChannel 不受嵌套 setTimeout 的最小延迟和后台标签定时器节流影响。
	return new Promise<void>((resolve) => {
		const channel = new MessageChannel();
		const finish = () => {
			channel.port1.close();
			channel.port2.close();
			signal.removeEventListener("abort", finish);
			resolve();
		};
		channel.port1.onmessage = finish;
		signal.addEventListener("abort", finish, { once: true });
		channel.port2.postMessage(null);
	});
}

/** 串行处理全部项目；取消返回 false，成功返回 true，单批异常原样抛出。 */
export async function drawInBatches<T>(
	items: readonly T[],
	draw: (batch: T[]) => Promise<void>,
	signal: AbortSignal,
	onProgress?: (completed: number) => void,
) {
	let offset = 0;
	let size = 192;
	while (offset < items.length) {
		await yieldToBrowser(signal);
		if (signal.aborted) return false;
		const batch = items.slice(offset, offset + size);
		const started = performance.now();
		await draw(batch);
		if (signal.aborted) return false;
		offset += batch.length;
		onProgress?.(offset);
		// G6 每批还要处理已有图元；设置工作量上下限，兼顾输入响应与总等待时间。
		size = Math.max(
			128,
			Math.min(
				384,
				Math.floor(
					(batch.length * 24) / Math.max(1, performance.now() - started),
				),
			),
		);
	}
	return !signal.aborted;
}
