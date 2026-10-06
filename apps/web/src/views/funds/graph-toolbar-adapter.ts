/**
 * @file G6 内置 Toolbar 与分析操作的 DOM 适配。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：原生工具栏统一承载加载状态、可编辑缩放和共享提示的锚点。
 * 被调用：GraphCanvas；调用：G6 Toolbar、zoomTo、aftertransform。
 * 预期结果：四组工具清晰分区，滚轮、输入、按钮及历史恢复的缩放读数一致。
 */
import type { Graph, Toolbar } from "@antv/g6";

export type GraphToolbarHint = { anchor: HTMLElement; text: string };
export type GraphToolbarController = {
	setStatus: (status: "loading" | "ready" | "error") => void;
	destroy: () => void;
};

/** 空画布 draw 后安装，默认禁用；百分比确认时校验并限制到 G6 范围。销毁前移除全部监听。 */
export async function attachGraphToolbar(
	graph: Graph,
	host: HTMLElement,
	slot: HTMLElement,
	hints: { id: string; onChange: (hint: GraphToolbarHint | null) => void },
): Promise<GraphToolbarController | undefined> {
	const plugin = graph.getPluginInstance<Toolbar>("funds-toolbar");
	await plugin.update({});
	if (graph.destroyed) return;
	const bar = host.querySelector<HTMLElement>(".funds-graph-toolbar");
	if (!bar) throw new Error("G6 Toolbar 未能初始化");
	bar.setAttribute("role", "group");
	bar.setAttribute("aria-label", "图谱悬浮工具栏");
	const items = bar.querySelectorAll<HTMLElement>(".g6-toolbar-item");
	const labels = new Map<HTMLElement, string>();
	for (const item of items) {
		labels.set(item, item.title);
		item.setAttribute("role", "button");
		item.setAttribute("aria-label", item.title);
		item.removeAttribute("title");
	}
	const input = document.createElement("input");
	input.className = "funds-graph-zoom";
	input.type = "text";
	input.inputMode = "decimal";
	input.autocomplete = "off";
	input.spellcheck = false;
	input.setAttribute("aria-label", "缩放比例（百分比）");
	labels.set(input, "输入缩放百分比，回车应用，Esc 取消");
	const zoomGroup = document.createElement("div");
	zoomGroup.className = "funds-graph-zoom-group";
	zoomGroup.setAttribute("role", "group");
	zoomGroup.setAttribute("aria-label", "画布缩放");
	const plus = bar.querySelector<HTMLElement>('[value="zoom-in"]');
	const minus = bar.querySelector<HTMLElement>('[value="zoom-out"]');
	if (!plus || !minus) throw new Error("G6 Toolbar 缺少缩放按钮");
	const separator = document.createElement("div");
	separator.className = "funds-graph-toolbar-separator";
	separator.setAttribute("aria-hidden", "true");
	bar.insertBefore(separator, plus);
	bar.insertBefore(zoomGroup, plus);
	zoomGroup.append(plus, input, minus);
	slot.className = "funds-graph-toolbar-extension";
	bar.appendChild(slot);
	let status: "loading" | "ready" | "error" = "loading";
	let dirty = false;
	let destroyed = false;
	let activeHint: HTMLElement | null = null;
	const events = new AbortController();
	const options = { signal: events.signal };
	const hideHint = () => {
		activeHint?.removeAttribute("aria-describedby");
		activeHint = null;
		hints.onChange(null);
	};
	const showHint = (anchor: HTMLElement, text = labels.get(anchor) ?? "") => {
		if (
			destroyed ||
			status !== "ready" ||
			anchor.getAttribute("aria-disabled") === "true"
		)
			return;
		activeHint?.removeAttribute("aria-describedby");
		activeHint = anchor;
		anchor.setAttribute("aria-describedby", hints.id);
		hints.onChange({ anchor, text });
	};
	const update = () => {
		if (destroyed || graph.destroyed) return;
		const ready = status === "ready";
		bar.setAttribute("aria-busy", String(status === "loading"));
		bar.dataset.state = status;
		const zoom = graph.getZoom();
		input.disabled = !ready;
		if (!dirty || !ready)
			input.value = ready
				? `${Number((zoom * 100).toFixed(1))}%`
				: status === "loading"
					? "加载中"
					: "失败";
		input.setAttribute(
			"aria-label",
			ready ? "缩放比例（百分比）" : "图谱加载状态",
		);
		const [min = 0.01, max = 10] = graph.getZoomRange() ?? [];
		for (const item of items) {
			const value = item.getAttribute("value");
			const disabled =
				!ready ||
				(value === "zoom-in"
					? zoom >= max
					: value === "zoom-out"
						? zoom <= min
						: !graph.getNodeData().length);
			item.setAttribute("aria-disabled", String(disabled));
			item.tabIndex = disabled ? -1 : 0;
		}
	};
	const commit = (fromBlur = false) => {
		if (!dirty || status !== "ready" || destroyed || graph.destroyed) return;
		const raw = input.value
			.trim()
			.replace(/[%％]$/, "")
			.trim();
		const percent = Number(raw);
		if (
			!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) ||
			!Number.isFinite(percent) ||
			percent <= 0
		) {
			if (fromBlur) {
				dirty = false;
				input.removeAttribute("aria-invalid");
				update();
			} else {
				input.setAttribute("aria-invalid", "true");
				showHint(input, "请输入大于 0 的缩放百分比");
			}
			return;
		}
		const [min = 0.01, max = 10] = graph.getZoomRange() ?? [];
		dirty = false;
		input.removeAttribute("aria-invalid");
		hideHint();
		void graph
			.zoomTo(Math.min(max, Math.max(min, percent / 100)), false)
			.then(update)
			.catch(() => {
				if (!destroyed && !graph.destroyed) {
					update();
					showHint(input, "缩放失败，请重试");
				}
			});
	};
	for (const element of labels.keys()) {
		element.addEventListener("pointerenter", () => showHint(element), options);
		element.addEventListener("pointerleave", hideHint, options);
		element.addEventListener("focus", () => showHint(element), options);
		element.addEventListener("blur", hideHint, options);
		element.addEventListener("click", hideHint, options);
	}
	input.addEventListener("focus", () => input.select(), options);
	input.addEventListener(
		"input",
		() => {
			dirty = true;
			input.removeAttribute("aria-invalid");
			hideHint();
		},
		options,
	);
	input.addEventListener("blur", () => commit(true), options);
	input.addEventListener(
		"keydown",
		(event) => {
			event.stopPropagation();
			if (event.isComposing) return;
			if (event.key === "Enter") {
				event.preventDefault();
				commit();
			}
			if (event.key === "Escape") {
				event.preventDefault();
				dirty = false;
				input.removeAttribute("aria-invalid");
				update();
				input.blur();
				hideHint();
			}
		},
		options,
	);
	input.addEventListener("wheel", (event) => event.stopPropagation(), options);
	bar.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape") hideHint();
			if (
				!(event.target instanceof HTMLElement) ||
				!event.target.classList.contains("g6-toolbar-item")
			)
				return;
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				if (event.target.getAttribute("aria-disabled") !== "true")
					event.target.click();
			}
		},
		options,
	);
	graph.on("aftertransform", update);
	update();
	// 插件初始隐藏，组装完整且禁用后才一次显示。
	bar.style.visibility = "visible";
	return {
		setStatus(next) {
			status = next;
			if (next !== "ready") hideHint();
			update();
		},
		destroy() {
			destroyed = true;
			events.abort();
			hideHint();
			graph.off("aftertransform", update);
			if (slot.parentElement === bar) slot.remove();
		},
	};
}
