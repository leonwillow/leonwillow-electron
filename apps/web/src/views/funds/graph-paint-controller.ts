/**
 * @file 资金图画面提交与主题换色过渡。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：G6 样式仍分批计算，纯配色更新完成后才提交完整画面。
 * 被调用：graph-canvas、graph-renderer；调用：AntV Canvas.render 和浏览器动画。
 * 预期结果：复用同一图实例；拖动、缩放、调整窗口或卸载立即结束旧画面过渡。
 */
import type { Graph } from "@antv/g6";

/** 图由调用方拥有；须配合关闭自动绘制的 Canvas renderer，signal 管理全部帧和监听。 */
export function createGraphPaintController(
	graph: Graph,
	container: HTMLElement,
	signal: AbortSignal,
	onError: () => void,
) {
	const layers = Object.values(graph.getCanvas().getLayers());
	let frameId = 0;
	let held = false;
	let reveal = false;
	let frame: HTMLDivElement | undefined;
	let animation: Animation | undefined;
	const active = () => !signal.aborted && !graph.destroyed;
	const removeFrame = () => {
		animation?.cancel();
		animation = undefined;
		frame?.remove();
		frame = undefined;
	};
	const cancel = () => {
		held = false;
		reveal = false;
		removeFrame();
	};
	const paint = () => {
		// 使用 G 的公开手动渲染入口，保留原有脏检查；四层共享同一个浏览器帧。
		if (!held) {
			for (const layer of layers) layer.render();
			if (reveal) {
				reveal = false;
				const previous = frame;
				if (previous) {
					if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
						removeFrame();
					} else {
						animation = previous.animate(
							[{ opacity: getComputedStyle(previous).opacity }, { opacity: 0 }],
							{
								duration: 160,
								easing: "cubic-bezier(0.16, 1, 0.3, 1)",
								fill: "forwards",
							},
						);
						const current = animation;
						void current.finished.then(
							() => {
								if (animation === current) removeFrame();
							},
							() => {},
						);
					}
				}
			}
		}
	};
	const tick = () => {
		if (!active()) return;
		try {
			paint();
			frameId = requestAnimationFrame(tick);
		} catch {
			cancel();
			onError();
		}
	};
	frameId = requestAnimationFrame(tick);
	// 装饰层不接收事件；输入发生时优先显示真实画面，不以过渡阻塞交互。
	for (const event of ["pointerdown", "pointermove", "wheel", "keydown"])
		container.addEventListener(event, cancel, {
			capture: true,
			passive: true,
			signal,
		});
	graph.on("beforetransform", cancel);
	graph.on("beforesizechange", cancel);
	signal.addEventListener(
		"abort",
		() => {
			cancelAnimationFrame(frameId);
			cancel();
			graph.off("beforetransform", cancel);
			graph.off("beforesizechange", cancel);
		},
		{ once: true },
	);

	return {
		/** 仅用于不改变几何、可见性或内容的纯配色更新。快照只存在于内存，不导出。 */
		begin(background: string, foreground: string) {
			if (!active()) return;
			held = true;
			reveal = false;
			if (frame) {
				frame.style.opacity = getComputedStyle(frame).opacity;
				animation?.cancel();
				animation = undefined;
				return;
			}
			const canvases = layers.map((layer) =>
				layer.getContextService().getDomElement(),
			);
			const source = canvases[0];
			if (
				!(source instanceof HTMLCanvasElement) ||
				!source.width ||
				!source.height
			)
				return;
			// 超大 / 高 DPR 窗口仍原子换色，但不额外分配超过约 32 MiB 的像素快照。
			if (source.width * source.height > 8_000_000) return;
			const snapshot = document.createElement("canvas");
			snapshot.width = source.width;
			snapshot.height = source.height;
			const context = snapshot.getContext("2d");
			if (!context) return;
			try {
				for (const canvas of canvases) {
					if (canvas instanceof HTMLCanvasElement)
						context.drawImage(canvas, 0, 0, snapshot.width, snapshot.height);
				}
			} catch {
				// 像素快照是装饰；无法复制时仍正常提交新颜色。
				return;
			}
			frame = document.createElement("div");
			frame.className = "funds-canvas-surface funds-graph-theme-frame";
			frame.setAttribute("aria-hidden", "true");
			frame.dataset.canvasPattern =
				container.parentElement?.dataset.canvasPattern;
			frame.style.backgroundColor = background;
			frame.style.setProperty("--funds-canvas-ink", foreground);
			frame.append(snapshot);
			container.append(frame);
		},
		/** 下一帧先提交完整的新颜色，再淡出旧画面；不等待动画完成来接收下一次主题。 */
		finish() {
			held = false;
			reveal = true;
		},
		cancel,
	};
}

export type GraphPaintController = ReturnType<
	typeof createGraphPaintController
>;
