/**
 * @file 服务关闭顺序与超时回归。
 * 创建时间：2026-10-04（本次新建）；修改时间：2026-10-04。
 * 版本作用：验证进程资源责任；被调用：test:unit；调用：lifecycle。
 * 功能：检查排空、幂等、失败清理及超时强停。
 * 预期结果：重复信号不会重复关闭池，挂起连接有截止时间。
 */
import { expect, test } from "bun:test";
import { createShutdown } from "../src/lifecycle";

test("先排空请求再关闭池，多次调用共用一次关闭", async () => {
	const events: string[] = [];
	const shutdown = createShutdown({
		stop: async () => {
			events.push("stop");
		},
		close: async () => {
			events.push("close");
		},
	});
	expect(shutdown()).toBe(shutdown());
	await shutdown();
	expect(events).toEqual(["stop", "close"]);
});

test("监听器关闭失败仍关闭数据库池", async () => {
	let closed = false;
	const shutdown = createShutdown({
		stop: async () => {
			throw new Error("stop failed");
		},
		close: async () => {
			closed = true;
		},
	});
	await expect(shutdown()).rejects.toThrow("stop failed");
	expect(closed).toBe(true);
});

test("超时后强停连接并尝试关闭池", async () => {
	const calls: boolean[] = [];
	let closed = false;
	const shutdown = createShutdown(
		{
			stop: async (force) => {
				calls.push(force);
				if (!force) await new Promise(() => {});
			},
			close: async () => {
				closed = true;
			},
		},
		20,
	);
	await expect(shutdown()).rejects.toThrow("超时");
	expect(calls).toEqual([false, true]);
	expect(closed).toBe(true);
});
