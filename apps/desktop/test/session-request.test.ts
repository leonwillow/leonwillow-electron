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
	readBoundedJson,
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

test("ReadableStream 上传请求流式写出并启用 chunkedEncoding，支持中途取消", async () => {
	const chunks: string[] = [];
	let ended = false;
	let aborted = false;
	const incoming = createFakeIncoming(200, ["Content-Type", "text/plain"]);
	const req = Object.assign(new EventEmitter(), {
		chunkedEncoding: false,
		write: (buf: Buffer, _encoding?: string, cb?: () => void) => {
			chunks.push(buf.toString("utf8"));
			queueMicrotask(() => cb?.());
		},
		end: () => {
			ended = true;
			queueMicrotask(() => req.emit("response", incoming));
		},
		abort: () => {
			aborted = true;
		},
	});
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("part-1:"));
			controller.enqueue(new TextEncoder().encode("part-2"));
			controller.close();
		},
	});
	const res = await executeSessionRequest(
		() => req as unknown as ClientRequest,
		{} as Session,
		"https://api.example.com/api/funds/import",
		{ method: "POST", body },
	);
	expect(req.chunkedEncoding).toBe(true);
	expect(ended).toBe(true);
	expect(aborted).toBe(false);
	expect(chunks.join("")).toBe("part-1:part-2");
	expect(await res.text()).toBe("ok");

	// 中途取消应中止流读取与请求
	let cancelled = false;
	const abortController = new AbortController();
	const hangingBody = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("first"));
		},
		cancel() {
			cancelled = true;
		},
	});
	const req2 = Object.assign(new EventEmitter(), {
		chunkedEncoding: false,
		write: (_buf: Buffer, _encoding?: string, cb?: () => void) =>
			queueMicrotask(() => cb?.()),
		end: () => {},
		abort: () => {
			aborted = true;
		},
	});
	const pending = executeSessionRequest(
		() => req2 as unknown as ClientRequest,
		{} as Session,
		"https://api.example.com/api/funds/import",
		{ method: "POST", body: hangingBody, signal: abortController.signal },
	);
	await Bun.sleep(5);
	abortController.abort(new Error("cancelled"));
	await expect(pending).rejects.toThrow("cancelled");
	expect(aborted).toBe(true);
	expect(cancelled).toBe(true);
});

test("readBoundedJson 拒绝超过上限的声明长度与分块响应", async () => {
	const ok = await readBoundedJson(
		new Response(JSON.stringify({ status: "ok" }), {
			headers: { "content-type": "application/json" },
		}),
		1024,
	);
	expect(ok).toEqual({ status: "ok" });

	const oversizedDeclared = new Response("{}", {
		headers: { "content-length": "999999" },
	});
	await expect(readBoundedJson(oversizedDeclared, 1024)).rejects.toThrow(
		"超出允许大小",
	);

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new Uint8Array(600));
			controller.enqueue(new Uint8Array(600));
			controller.close();
		},
	});
	await expect(readBoundedJson(new Response(stream), 1024)).rejects.toThrow(
		"超出允许大小",
	);
});
