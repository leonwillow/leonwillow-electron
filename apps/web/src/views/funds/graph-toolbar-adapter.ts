/**
 * @file G6 内置 Toolbar 与分析操作的 DOM 适配。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：原生工具栏统一承载加载状态、可编辑缩放和共享提示的锚点。
 * 被调用：GraphCanvas；调用：G6 Toolbar、zoomTo、aftertransform、停靠控制器。
 * 预期结果：各组工具清晰分区，停靠和折叠不改变滚轮、输入及历史的缩放读数。
 */
import type { Graph, Toolbar } from "@antv/g6";
import type { ToolbarLayout } from "@/lib/funds-toolbar-layout";
import {
	attachToolbarDock,
	type ToolbarDock,
	type ToolbarDockState,
} from "./graph-toolbar-dock";
import { createGraphZoomField } from "./graph-zoom-field";

export type GraphToolbarHint = { anchor: HTMLElement; text: string };
export type GraphToolbarController = {
	setStatus: (status: "loading" | "ready" | "error") => void;
	dock: ToolbarDock;
	hint: { enter: () => void; leave: () => void; close: () => void };
	destroy: () => void;
};

/** 空画布 draw 后安装，默认禁用；百分比确认时校验并限制到 G6 范围。销毁前移除全部监听。 */
export async function attachGraphToolbar(
	graph: Graph,
	host: HTMLElement,
	slot: HTMLElement,
	toggleSlot: HTMLElement,
	layout: ToolbarLayout,
	hints: { id: string; onChange: (hint: GraphToolbarHint | null) => void },
	onDockStateChange: (state: ToolbarDockState) => void,
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
	const zoomField = createGraphZoomField();
	const { input } = zoomField;
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
	zoomGroup.append(plus, zoomField.element, minus);
	slot.className = "funds-graph-toolbar-extension";
	bar.appendChild(slot);
	let status: "loading" | "ready" | "error" = "loading";
	let dirty = false;
	let destroyed = false;
	let activeHint: HTMLElement | null = null;
	let hintTimer: ReturnType<typeof setTimeout> | undefined;
	const events = new AbortController();
	const options = { signal: events.signal };
	const hideHint = () => {
		clearTimeout(hintTimer);
		activeHint?.removeAttribute("aria-describedby");
		activeHint = null;
		hints.onChange(null);
	};
	// 原生 G6 项没有 React Trigger；跨越按钮与气泡间隙时保留一次短暂关闭宽限。
	const leaveHint = () => {
		clearTimeout(hintTimer);
		hintTimer = setTimeout(() => {
			// 原生 leave 与 Portal 的 React enter 顺序可能相反，以实际命中结果为准。
			if (
				activeHint?.matches(":hover") ||
				document.getElementById(hints.id)?.matches(":hover")
			)
				return;
			hideHint();
		}, 180);
	};
	const showHint = (anchor: HTMLElement, text = labels.get(anchor) ?? "") => {
		if (
			destroyed ||
			status !== "ready" ||
			bar.dataset.moving === "true" ||
			anchor.getAttribute("aria-disabled") === "true"
		)
			return;
		clearTimeout(hintTimer);
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
		zoomField.sync();
		labels.set(input, `${input.value} · 输入缩放百分比，回车应用，Esc 取消`);
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
		element.addEventListener("pointerleave", leaveHint, options);
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
	const dock = attachToolbarDock(
		bar,
		host,
		toggleSlot,
		layout,
		hideHint,
		onDockStateChange,
	);
	graph.on("aftertransform", update);
	update();
	// 插件初始隐藏，组装完整且禁用后才一次显示。
	bar.style.visibility = "visible";
	return {
		dock,
		hint: {
			enter: () => clearTimeout(hintTimer),
			leave: leaveHint,
			close: hideHint,
		},
		setStatus(next) {
			status = next;
			dock.setReady(next === "ready");
			if (next !== "ready") hideHint();
			update();
		},
		destroy() {
			destroyed = true;
			events.abort();
			zoomField.destroy();
			dock.destroy();
			hideHint();
			graph.off("aftertransform", update);
			slot.remove();
		},
	};
}
