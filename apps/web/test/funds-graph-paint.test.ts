/**
 * @file 主题画面提交、交互中断与绘图资源生命周期回归。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-21
 * 版本作用：以可控帧队列验证旧画面不会泄露分批结果或阻塞后续交互，并验证 renderer flush 竞态与局部增量更新。
 * 被调用：bun test；调用：graph-paint-controller、graph-renderer，Canvas/DOM 最小替身。
 * 预期结果：完整提交最新版，输入/卸载/失败释放快照，微任务间隙连续切色不锁死，隐藏节点仅更新关联图元。
 */
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { EdgeData, Graph, NodeData } from "@antv/g6";
import { createGraphPaintController } from "../src/views/funds/graph-paint-controller";
import { createGraphRenderer } from "../src/views/funds/graph-renderer";
import type { AnalysisGraph } from "../src/views/funds/model/analysis";

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

test("renderer 连续换色在微任务间隙不会丢更新或锁死 held，隐藏单节点只增量更新关联边", async () => {
	let primary = "#2563eb";
	let background = "#ffffff";
	const rootStyle = { fontSize: "16px" };
	const containerStyle = {
		fontFamily: "sans-serif",
		getPropertyValue: (name: string) =>
			name === "--primary"
				? primary
				: name === "--funds-canvas-background" || name === "--background"
					? background
					: name === "--foreground"
						? "#111111"
						: "#666666",
	};
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			documentElement: rootStyle,
			createElement: (tag: string) =>
				tag === "canvas" ? new TestCanvas() : new TestFrame(),
		},
	});
	Object.defineProperty(globalThis, "getComputedStyle", {
		configurable: true,
		value: (el: unknown) =>
			el === rootStyle
				? rootStyle
				: el instanceof TestFrame
					? el.style
					: containerStyle,
	});
	const updatedNodes: NodeData[][] = [];
	const updatedEdges: EdgeData[][] = [];
	const graph = {
		destroyed: false,
		getSize: () => [800, 600],
		getZoom: () => 1,
		zoomTo: mock(async () => {}),
		getViewportByCanvas: () => [400, 300],
		translateBy: mock(async () => {}),
		addNodeData: mock(() => {}),
		addEdgeData: mock(() => {}),
		updateNodeData: mock((batch: NodeData[]) => {
			updatedNodes.push(batch);
		}),
		updateEdgeData: mock((batch: EdgeData[]) => {
			updatedEdges.push(batch);
		}),
		draw: mock(async () => {}),
		fitView: mock(async () => {}),
	};
	const paintEvents: string[] = [];
	let held = false;
	const paintController = {
		begin: mock(() => {
			held = true;
			paintEvents.push("begin");
		}),
		finish: mock(() => {
			held = false;
			paintEvents.push("finish");
		}),
		cancel: mock(() => {
			held = false;
			paintEvents.push("cancel");
		}),
	};
	const makeNode = (id: string): AnalysisGraph["nodes"][number] => ({
		id,
		number: id,
		names: [id],
		ownNames: [id],
		hasStatement: true,
		unknown: false,
		firstSeen: "",
		lastSeen: "",
		accountNumbers: [id],
		identityStatus: "manual",
		basis: "test",
		accounts: [],
	});
	const data: AnalysisGraph = {
		nodes: [makeNode("a"), makeNode("b"), makeNode("c")],
		edges: [
			{
				id: "e-ab",
				from: "a",
				to: "b",
				fromAccount: "a",
				toAccount: "b",
				amountMinor: "100",
				currency: "CNY",
				timestamp: "2026-01-01T00:00:00+08:00",
				lastTimestamp: "2026-01-01T00:00:00+08:00",
				summary: "",
				evidenceIds: ["e-ab"],
				reconciliation: "single",
				transactionIds: ["e-ab"],
				count: 1,
				aggregated: false,
			},
			{
				id: "e-bc",
				from: "b",
				to: "c",
				fromAccount: "b",
				toAccount: "c",
				amountMinor: "200",
				currency: "CNY",
				timestamp: "2026-01-02T00:00:00+08:00",
				lastTimestamp: "2026-01-02T00:00:00+08:00",
				summary: "",
				evidenceIds: ["e-bc"],
				reconciliation: "single",
				transactionIds: ["e-bc"],
				count: 1,
				aggregated: false,
			},
		],
	};
	const presentation = { a: {}, b: {}, c: {} };
	const renderer = createGraphRenderer({
		graph: graph as unknown as Graph,
		container: {} as HTMLElement,
		data,
		presentation,
		signal: lifetime.signal,
		onProgress: () => {},
		onError: () => {
			throw new Error("unexpected renderer error");
		},
		paintController,
	});
	const loadPromise = renderer.load();
	await loadPromise;

	// 1. 隐藏单节点 a，仅更新节点 a 与关联边 e-ab，不应碰 b/c 或 e-bc。
	updatedNodes.length = 0;
	updatedEdges.length = 0;
	renderer.update({ a: { hidden: true }, b: {}, c: {} });
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(updatedNodes.flat().map((n) => n.id)).toEqual(["a"]);
	expect(updatedEdges.flat().map((e) => e.id)).toEqual(["e-ab"]);

	// 2. 在第一次纯换色刚完成 finish() 的同一微任务链中立即再次换色，不应丢弃第二次更新或锁死 held。
	let triggeredSecond = false;
	paintController.finish.mockImplementation(() => {
		held = false;
		paintEvents.push("finish");
		if (!triggeredSecond) {
			triggeredSecond = true;
			primary = "#dc2626";
			background = "#0f172a";
			renderer.update({ a: { hidden: true }, b: {}, c: {} });
		}
	});
	primary = "#16a34a";
	renderer.update({ a: { hidden: true }, b: {}, c: {} });
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(held).toBe(false);
	expect(paintEvents.at(-1)).toBe("finish");
	expect(updatedNodes.flat().at(-1)?.style?.fill).toBe("#dc2626");
});
