/**
 * @file 固定宽度的图谱缩放输入与溢出读数。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：显示层按实际溢出距离往返移动，输入层保留原生编辑与焦点。
 * 被调用：graph-toolbar-adapter；调用：ResizeObserver、共享工具栏样式。
 * 预期结果：读数长度不改变工具栏宽度，编辑及减少动态效果时停止滚动。
 */

/** 调用方负责输入校验；值更新后调用 sync，工具栏销毁时调用 destroy。 */
export function createGraphZoomField() {
	const element = document.createElement("div");
	element.className = "funds-graph-zoom-control";
	const input = document.createElement("input");
	input.className = "funds-graph-zoom";
	input.type = "text";
	input.inputMode = "decimal";
	input.autocomplete = "off";
	input.spellcheck = false;
	input.setAttribute("aria-label", "缩放比例（百分比）");
	const display = document.createElement("div");
	display.className = "funds-graph-zoom-display";
	display.setAttribute("aria-hidden", "true");
	const text = document.createElement("span");
	display.append(text);
	element.append(input, display);
	let frame = 0;
	const measure = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			frame = 0;
			const overflow = Math.max(0, text.scrollWidth - display.clientWidth);
			display.dataset.overflow = String(overflow > 1);
			display.style.setProperty("--funds-zoom-overflow", `${-overflow}px`);
		});
	};
	const observer = new ResizeObserver(measure);
	observer.observe(display);
	observer.observe(text);
	return {
		element,
		input,
		sync() {
			if (text.textContent !== input.value) {
				text.textContent = input.value;
				measure();
			}
		},
		destroy() {
			observer.disconnect();
			cancelAnimationFrame(frame);
		},
	};
}
