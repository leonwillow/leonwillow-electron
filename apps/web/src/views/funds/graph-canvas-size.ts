/**
 * @file 图谱页签的可见尺寸等待与隐藏保护。
 * 创建时间：2026-10-08
 * 修改时间：2026-10-08
 * 版本作用：隐藏页签保留画布，只有可见且有尺寸时才初始化或调整视口。
 * 被调用：graph-canvas 与回归测试；调用：ResizeObserver、AbortSignal。
 * 预期结果：隐藏期间不产生零尺寸镜头，取消等待后释放监听。
 */
export function readCanvasSize(
	container: HTMLElement,
): [number, number] | null {
	const { clientWidth: width, clientHeight: height } = container;
	return width > 0 && height > 0 ? [width, height] : null;
}

/** 返回可用尺寸；页面卸载或旧数据失效时返回 null，不启动旧画布。 */
export function waitForCanvasSize(
	container: HTMLElement,
	signal: AbortSignal,
): Promise<[number, number] | null> {
	if (signal.aborted) return Promise.resolve(null);
	const size = readCanvasSize(container);
	if (size) return Promise.resolve(size);
	return new Promise((resolve) => {
		const finish = (next: [number, number] | null) => {
			observer.disconnect();
			signal.removeEventListener("abort", cancel);
			resolve(next);
		};
		const cancel = () => finish(null);
		const observer = new ResizeObserver(() => {
			const next = readCanvasSize(container);
			if (next) finish(next);
		});
		signal.addEventListener("abort", cancel, { once: true });
		observer.observe(container);
	});
}
