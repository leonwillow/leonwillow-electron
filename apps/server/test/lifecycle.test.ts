/**
 * @file 服务关闭顺序、超时与连接池错误监听回归。
 * 创建时间：2026-10-04（本次新建）；修改时间：2026-11-21。
 * 版本作用：验证进程资源责任；被调用：test:unit；调用：lifecycle、@leonwillow-electron/db。
 * 功能：检查排空、幂等、失败清理、超时强停及 pg.Pool 空闲错误监听。
 * 预期结果：重复信号不会重复关闭池，挂起连接有截止时间，连接池错误不会引发未捕获异常。
 */
import { expect, spyOn, test } from "bun:test";
import { createDatabase } from "@leonwillow-electron/db";
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

test("createDatabase 为 pg.Pool 绑定 error 监听，空闲连接断连不会抛出未捕获异常", async () => {
	const errorSpy = spyOn(console, "error").mockImplementation(() => {});
	const { pool } = createDatabase("postgres://user:pass@127.0.0.1:5432/test");
	try {
		expect(pool.listenerCount("error")).toBeGreaterThanOrEqual(1);
		expect(() => {
			pool.emit("error", new Error("connection terminated unexpectedly"));
		}).not.toThrow();
		expect(errorSpy).toHaveBeenCalled();
	} finally {
		errorSpy.mockRestore();
		await pool.end();
	}
});
