/**
 * @file 主题明暗渐变过渡的回归测试。
 * 创建时间：2026-11-19
 * 修改时间：2026-11-19
 * 版本作用：覆盖侧栏切换与主题设置面板共用的 View Transition 协调逻辑，不进入产品构建。
 * 被调用：Bun 测试命令、test:ui。
 * 调用：bun:test、lib/theme-transition。
 * 功能：验证明暗变化触发 sweep 过渡、跟随系统解析同色跳过空动画、快速连续切换及降级回退。
 * 预期结果：状态始终提交、过渡标记按当前操作清理且不遗留旧回调副作用。
 */
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
	resolveThemeMode,
	runThemeTransition,
	toggleThemeTransition,
} from "../src/lib/theme-transition";

type Deferred = {
	promise: Promise<void>;
	resolve: () => void;
	reject: (reason?: unknown) => void;
};

function createDeferred(): Deferred {
	let resolve!: () => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const originalGlobals = Object.fromEntries(
	["document", "window"].map((name) => [
		name,
		Object.getOwnPropertyDescriptor(globalThis, name),
	]),
);

let attributes: Map<string, string>;
let reducedMotion = false;
let prefersDark = false;
let visibilityState: DocumentVisibilityState = "visible";
let transitions: Array<{
	apply: () => void;
	ready: Deferred;
	finished: Deferred;
	skipTransition: ReturnType<typeof mock<() => void>>;
}>;

beforeEach(() => {
	attributes = new Map();
	reducedMotion = false;
	prefersDark = false;
	visibilityState = "visible";
	transitions = [];

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			matchMedia: (query: string) => ({
				matches:
					query === "(prefers-reduced-motion: reduce)"
						? reducedMotion
						: query === "(prefers-color-scheme: dark)"
							? prefersDark
							: false,
			}),
		},
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			get visibilityState() {
				return visibilityState;
			},
			documentElement: {
				setAttribute: (key: string, value: string) =>
					attributes.set(key, value),
				removeAttribute: (key: string) => attributes.delete(key),
			},
			startViewTransition: (apply: () => void) => {
				const ready = createDeferred();
				const finished = createDeferred();
				const skipTransition = mock(() => {});
				transitions.push({ apply, ready, finished, skipTransition });
				return {
					ready: ready.promise,
					finished: finished.promise,
					skipTransition,
				};
			},
		},
	});
});

afterEach(async () => {
	for (const item of transitions) {
		item.ready.resolve();
		item.finished.resolve();
	}
	await Promise.resolve();
	for (const [name, descriptor] of Object.entries(originalGlobals)) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

test("resolveThemeMode 优先采用显式明暗，system 时读取系统解析或媒体查询", () => {
	expect(resolveThemeMode("light", "dark")).toBe("light");
	expect(resolveThemeMode("dark", "light")).toBe("dark");
	expect(resolveThemeMode("system", "dark")).toBe("dark");
	expect(resolveThemeMode("system", "light")).toBe("light");
	prefersDark = true;
	expect(resolveThemeMode("system")).toBe("dark");
	prefersDark = false;
	expect(resolveThemeMode("system")).toBe("light");
});

test("解析明暗变化时启动 sweep 过渡，结束后清理过渡标记", async () => {
	const commit = mock(() => {});
	runThemeTransition("light", "dark", commit);
	expect(attributes.get("data-theme-transition")).toBe("sweep");
	expect(transitions).toHaveLength(1);
	expect(commit).not.toHaveBeenCalled();

	transitions[0]?.apply();
	expect(commit).toHaveBeenCalledTimes(1);
	transitions[0]?.ready.resolve();
	transitions[0]?.finished.resolve();
	await Promise.resolve();
	expect(attributes.has("data-theme-transition")).toBe(false);
});

test("解析明暗未变时直接提交，不启动空 View Transition", () => {
	const commit = mock(() => {});
	runThemeTransition("light", "light", commit);
	expect(transitions).toHaveLength(0);
	expect(commit).toHaveBeenCalledTimes(1);
	expect(attributes.has("data-theme-transition")).toBe(false);
});

test("过渡中途快速切换目标会跳过旧过渡，且旧回调不覆盖新状态", async () => {
	const firstCommit = mock(() => {});
	const secondCommit = mock(() => {});
	runThemeTransition("light", "dark", firstCommit);
	toggleThemeTransition("light", (mode) => {
		expect(mode).toBe("light");
		secondCommit();
	});

	expect(transitions).toHaveLength(2);
	expect(transitions[0]?.skipTransition).toHaveBeenCalledTimes(1);

	transitions[0]?.apply();
	transitions[0]?.finished.resolve();
	await Promise.resolve();
	expect(firstCommit).not.toHaveBeenCalled();
	expect(attributes.get("data-theme-transition")).toBe("sweep");

	transitions[1]?.apply();
	expect(secondCommit).toHaveBeenCalledTimes(1);
	transitions[1]?.ready.resolve();
	transitions[1]?.finished.resolve();
	await Promise.resolve();
	expect(attributes.has("data-theme-transition")).toBe(false);
});

test("系统减少动态效果、隐藏页签或不支持 API 时直接提交", () => {
	reducedMotion = true;
	const commitReduced = mock(() => {});
	runThemeTransition("light", "dark", commitReduced);
	expect(transitions).toHaveLength(0);
	expect(commitReduced).toHaveBeenCalledTimes(1);

	reducedMotion = false;
	visibilityState = "hidden";
	const commitHidden = mock(() => {});
	runThemeTransition("light", "dark", commitHidden);
	expect(transitions).toHaveLength(0);
	expect(commitHidden).toHaveBeenCalledTimes(1);

	visibilityState = "visible";
	Reflect.deleteProperty(document, "startViewTransition");
	const commitUnsupported = mock(() => {});
	runThemeTransition("light", "dark", commitUnsupported);
	expect(commitUnsupported).toHaveBeenCalledTimes(1);
});
