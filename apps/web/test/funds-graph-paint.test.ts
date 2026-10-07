/**
 * @file 主题画面提交、交互中断与绘图资源生命周期回归。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：以可控帧队列验证旧画面不会泄露分批结果或阻塞后续交互。
 * 被调用：bun test；调用：graph-paint-controller，Canvas/DOM 最小替身。
 * 预期结果：完整提交最新版，输入/卸载/失败释放快照，减少动态效果不播放淡入。
 */
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { Graph } from "@antv/g6";
import { createGraphPaintController } from "../src/views/funds/graph-paint-controller";

const globals = [
	"requestAnimationFrame",
	"cancelAnimationFrame",
	"document",
	"HTMLCanvasElement",
	"getComputedStyle",
	"matchMedia",
];
const original = new Map(
	globals.map((name) => [
		name,
		Object.getOwnPropertyDescriptor(globalThis, name),
	]),
);
let frames: Map<number, () => void>;
let nextId: number;
let reducedMotion: boolean;
let copies: number;
let lifetime: AbortController;

class TestCanvas {
	width = 100;
	height = 100;
	getContext() {
		return {
			drawImage: () => {
				copies++;
			},
		};
	}
}

class TestFrame {
	style = { opacity: "1", backgroundColor: "", setProperty: mock(() => {}) };
	dataset: Record<string, string | undefined> = {};
	className = "";
	removed = false;
	setAttribute = mock(() => {});
	append = mock(() => {});
	remove() {
		this.removed = true;
	}
	animate = mock(() => ({
		finished: Promise.resolve(),
		cancel: mock(() => {}),
	}));
}

beforeEach(() => {
	frames = new Map();
	nextId = 0;
	copies = 0;
	reducedMotion = false;
	lifetime = new AbortController();
	const values = {
		requestAnimationFrame: (callback: () => void) => {
			frames.set(++nextId, callback);
			return nextId;
		},
		cancelAnimationFrame: (id: number) => frames.delete(id),
		document: {
			createElement: (tag: string) =>
				tag === "canvas" ? new TestCanvas() : new TestFrame(),
		},
		HTMLCanvasElement: TestCanvas,
		getComputedStyle: (element: TestFrame) => element.style,
		matchMedia: () => ({ matches: reducedMotion }),
	};
	for (const [name, value] of Object.entries(values))
		Object.defineProperty(globalThis, name, { configurable: true, value });
});

afterEach(() => {
	lifetime.abort();
	for (const [name, descriptor] of original) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

function tick() {
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending) callback();
}

function setup() {
	const layers = Array.from({ length: 4 }, () => ({
		render: mock(() => {}),
		getContextService: () => ({ getDomElement: () => new TestCanvas() }),
	}));
	const events = new Map<string, () => void>();
	const graph = {
		destroyed: false,
		getCanvas: () => ({ getLayers: () => layers }),
		on: (name: string, callback: () => void) => events.set(name, callback),
		off: (name: string) => events.delete(name),
	};
	const container = Object.assign(new EventTarget(), {
		parentElement: { dataset: { canvasPattern: "grid" } },
		children: [] as TestFrame[],
		append(frame: TestFrame) {
			this.children.push(frame);
		},
	});
	const error = mock(() => {});
	const controller = createGraphPaintController(
		graph as unknown as Graph,
		container as unknown as HTMLElement,
		lifetime.signal,
		error,
	);
	return { controller, container, layers, events, error };
}

test("配色分批准备时不提交中间画面，最终只提交一次完整画面并释放快照", async () => {
	const { controller, container, layers } = setup();
	tick();
	controller.begin("#ffffff", "#111111");
	tick();
	tick();
	expect(layers.map((layer) => layer.render.mock.calls.length)).toEqual([
		1, 1, 1, 1,
	]);
	expect(copies).toBe(4);
	controller.finish();
	tick();
	expect(layers.map((layer) => layer.render.mock.calls.length)).toEqual([
		2, 2, 2, 2,
	]);
	expect(container.children[0]?.animate).toHaveBeenCalledTimes(1);
	await Promise.resolve();
	expect(container.children[0]?.removed).toBe(true);
});

test("快速连续切换复用快照，下一主题准备好之前不提前提交", () => {
	const { controller, container, layers } = setup();
	controller.begin("#ffffff", "#111111");
	controller.finish();
	controller.begin("#111111", "#ffffff");
	tick();
	expect(layers[0]?.render).not.toHaveBeenCalled();
	expect(container.children).toHaveLength(1);
	expect(copies).toBe(4);
	controller.finish();
	tick();
	expect(layers[0]?.render).toHaveBeenCalledTimes(1);
});

test("鼠标、键盘、镜头和尺寸变化都立即取消过渡并恢复真实画面", () => {
	const { controller, container, layers, events } = setup();
	for (const name of [
		"pointerdown",
		"pointermove",
		"wheel",
		"keydown",
		"beforetransform",
		"beforesizechange",
	]) {
		controller.begin("#ffffff", "#111111");
		if (events.has(name)) events.get(name)?.();
		else container.dispatchEvent(new Event(name));
		expect(container.children.at(-1)?.removed).toBe(true);
		tick();
	}
	expect(layers[0]?.render).toHaveBeenCalledTimes(6);
});

test("减少动态效果仍完整提交但不播放动画，卸载清除帧和监听", () => {
	reducedMotion = true;
	const { controller, container, events } = setup();
	controller.begin("#ffffff", "#111111");
	controller.finish();
	tick();
	expect(container.children[0]?.animate).not.toHaveBeenCalled();
	expect(container.children[0]?.removed).toBe(true);
	controller.begin("#111111", "#ffffff");
	lifetime.abort();
	expect(frames.size).toBe(0);
	expect(events.size).toBe(0);
	expect(container.children.at(-1)?.removed).toBe(true);
});

test("实际绘制失败释放过渡并报告错误，不留下静止假画面", () => {
	const { controller, container, layers, error } = setup();
	controller.begin("#ffffff", "#111111");
	layers[0]?.render.mockImplementation(() => {
		throw new Error("paint failed");
	});
	controller.finish();
	tick();
	expect(error).toHaveBeenCalledTimes(1);
	expect(container.children[0]?.removed).toBe(true);
	expect(frames.size).toBe(0);
});
