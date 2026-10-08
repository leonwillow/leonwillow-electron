/**
 * @file 图谱页签隐藏、再次显示及切案取消的尺寸回归。
 * 创建时间：2026-10-08
 * 修改时间：2026-10-08
 * 被调用：bun test；调用：graph-canvas-size 和可控 ResizeObserver。
 * 预期结果：只接受非零尺寸，隐藏期间等待，旧任务取消后释放观察器。
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	readCanvasSize,
	waitForCanvasSize,
} from "../src/views/funds/graph-canvas-size";

const original = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
let observers: TestObserver[];
class TestObserver {
	disconnected = false;
	constructor(readonly callback: () => void) {
		observers.push(this);
	}
	observe() {}
	disconnect() {
		this.disconnected = true;
	}
}
beforeEach(() => {
	observers = [];
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true,
		value: TestObserver,
	});
});
afterEach(() => {
	if (original) Object.defineProperty(globalThis, "ResizeObserver", original);
	else Reflect.deleteProperty(globalThis, "ResizeObserver");
});
const container = (width: number, height: number) =>
	({ clientWidth: width, clientHeight: height }) as HTMLElement;

test("可见画布立即采用实际尺寸，不创建等待观察器", async () => {
	const host = container(800, 500);
	expect(readCanvasSize(host)).toEqual([800, 500]);
	expect(await waitForCanvasSize(host, new AbortController().signal)).toEqual([
		800, 500,
	]);
	expect(observers).toHaveLength(0);
});

test("隐藏页签不接受零尺寸，显示时继续绘制并释放等待", async () => {
	const host = container(0, 0);
	let finished = false;
	const waiting = waitForCanvasSize(host, new AbortController().signal).then(
		(size) => {
			finished = true;
			return size;
		},
	);
	expect(readCanvasSize(host)).toBeNull();
	Object.assign(host, { clientWidth: 900 });
	observers[0]?.callback();
	await Promise.resolve();
	expect(finished).toBe(false);
	Object.assign(host, { clientHeight: 600 });
	observers[0]?.callback();
	expect(await waiting).toEqual([900, 600]);
	expect(observers[0]?.disconnected).toBe(true);
});

test("等待期间切案或卸载取消旧画布，预先取消也不监听", async () => {
	const lifetime = new AbortController();
	const host = container(0, 0);
	const waiting = waitForCanvasSize(host, lifetime.signal);
	lifetime.abort();
	expect(await waiting).toBeNull();
	expect(observers[0]?.disconnected).toBe(true);
	expect(
		await waitForCanvasSize(container(800, 500), lifetime.signal),
	).toBeNull();
	expect(observers).toHaveLength(1);
});
