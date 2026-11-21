/**
 * @file 桌面 sessionRequest 非标响应头与状态码异常防护回归测试。
 * 创建时间：2026-11-21；修改时间：2026-11-21。
 * 被调用：bun run test:desktop；调用：executeSessionRequest。
 * 功能：验证上游返回非 Latin-1 响应头或越界状态码时，不抛出未捕获事件异常且清理流与请求。
 */
import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { ClientRequest, Session } from "electron";
import {
	executeSessionRequest,
	type IncomingResponseLike,
} from "../src/session-request-core";

function createFakeRequest(emitResponse: (req: EventEmitter) => void) {
	let aborted = false;
	const req = Object.assign(new EventEmitter(), {
		abort: () => {
			aborted = true;
		},
		end: () => {
			queueMicrotask(() => emitResponse(req));
		},
	});
	return {
		req: req as unknown as ClientRequest,
		wasAborted: () => aborted,
	};
}

function createFakeIncoming(
	statusCode: number,
	rawHeaders: string[],
): IncomingResponseLike {
	const stream = new Readable({
		read() {
			this.push("ok");
			this.push(null);
		},
	});
	return Object.assign(stream, {
		rawHeaders,
		statusCode,
		statusMessage: "OK",
	});
}

test("上游返回非 Latin-1 响应头时拒绝 Promise、销毁响应流并中止请求，不引发未捕获异常", async () => {
	const incoming = createFakeIncoming(200, [
		"Content-Disposition",
		'attachment; filename="中文.docx"',
	]);
	const fake = createFakeRequest((req) => req.emit("response", incoming));
	await expect(
		executeSessionRequest(
			() => fake.req,
			{} as Session,
			"https://api.example.com/api/documents/1",
			{ method: "GET" },
		),
	).rejects.toThrow();
	expect(incoming.destroyed).toBe(true);
	expect(fake.wasAborted()).toBe(true);
});

test("上游返回越界 HTTP 状态码时拒绝 Promise 并清理资源", async () => {
	const incoming = createFakeIncoming(999, ["Content-Type", "text/plain"]);
	const fake = createFakeRequest((req) => req.emit("response", incoming));
	await expect(
		executeSessionRequest(
			() => fake.req,
			{} as Session,
			"https://api.example.com/api/health",
			{ method: "GET" },
		),
	).rejects.toThrow();
	expect(incoming.destroyed).toBe(true);
	expect(fake.wasAborted()).toBe(true);
});

test("正常响应正常透传状态码、响应头和流正文", async () => {
	const incoming = createFakeIncoming(200, [
		"Content-Type",
		"application/json",
	]);
	const fake = createFakeRequest((req) => req.emit("response", incoming));
	const response = await executeSessionRequest(
		() => fake.req,
		{} as Session,
		"https://api.example.com/api/health",
		{ method: "GET" },
	);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/json");
	expect(await response.text()).toBe("ok");
	expect(fake.wasAborted()).toBe(false);
});
