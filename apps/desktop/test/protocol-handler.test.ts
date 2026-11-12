/**
 * @file 桌面 API 转发和静态文件的集成回归。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：Bun test；功能：真实Request/Response验证输入来源、二进制响应及服务器切换。
 */
import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProtocolHandler } from "../src/protocol-handler";

function apiRequest(path: string, options?: RequestInit) {
	return Object.assign(new Request(`aidesk://app${path}`, options), {
		initiatorOrigin: "aidesk://app",
	});
}
test("本地SPA资源和API请求分开处理，源站只能来自配置", async () => {
	const root = await mkdtemp(join(tmpdir(), "aidesk-renderer-"));
	await writeFile(join(root, "index.html"), "<div>app</div>");
	let target = "http://localhost:3000";
	const requested: string[] = [];
	const handler = createProtocolHandler({
		rendererRoot: root,
		getTarget: () => ({
			url: target,
			fetch: async (url, options) => {
				requested.push(url);
				expect(options.redirect).toBe("error");
				expect(options.credentials).toBe("include");
				expect(new Headers(options.headers).get("origin")).toBe("aidesk://app");
				return new Response(new Uint8Array([0, 255, 100]), {
					headers: {
						"set-cookie": "secret",
						"content-type": "application/octet-stream",
					},
				});
			},
		}),
	});
	try {
		const page = await handler.handle(new Request("aidesk://app/login"));
		expect(await page.text()).toBe("<div>app</div>");
		expect(page.headers.get("content-security-policy")).toContain(
			"connect-src 'self'",
		);
		expect(
			(await handler.handle(new Request("aidesk://app/api/auth/session")))
				.status,
		).toBe(403);
		const response = await handler.handle(
			apiRequest("/api/inquiries/file?name=test"),
		);
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(
			new Uint8Array([0, 255, 100]),
		);
		expect(response.headers.has("set-cookie")).toBe(false);
		target = "https://api.example.com:8443";
		await (await handler.handle(apiRequest("/api/health"))).arrayBuffer();
		expect(requested).toEqual([
			"http://localhost:3000/api/inquiries/file?name=test",
			"https://api.example.com:8443/api/health",
		]);
	} finally {
		handler.cancel();
		await rm(root, { recursive: true, force: true });
	}
});

test("已返回响应头的大文件仍在切换服务器时中止", async () => {
	let observed: AbortSignal | undefined | null;
	const handler = createProtocolHandler({
		rendererRoot: "/tmp",
		getTarget: () => ({
			url: "http://localhost:3000",
			fetch: async (_url, options) => {
				observed = options.signal;
				return new Response(
					new ReadableStream<Uint8Array>({
						start(output) {
							output.enqueue(new Uint8Array([0, 255]));
							options.signal?.addEventListener(
								"abort",
								() => output.error(new Error("aborted")),
								{ once: true },
							);
						},
					}),
				);
			},
		}),
	});
	const response = await handler.handle(apiRequest("/api/inquiries/file"));
	const reader = response.body?.getReader();
	expect(reader).toBeDefined();
	expect((await reader?.read())?.value).toEqual(new Uint8Array([0, 255]));
	const pending = reader?.read();
	handler.cancel();
	expect(observed?.aborted).toBe(true);
	await expect(pending).rejects.toThrow();
});

test("服务器切换中止尚未完成的旧网络请求", async () => {
	let observed: AbortSignal | undefined | null;
	const handler = createProtocolHandler({
		rendererRoot: "/tmp",
		getTarget: () => ({
			url: "http://localhost:3000",
			fetch: async (_url, options) => {
				observed = options.signal;
				return new Promise<Response>((_resolve, reject) =>
					options.signal?.addEventListener("abort", () =>
						reject(new Error("aborted")),
					),
				);
			},
		}),
	});
	const request = handler.handle(apiRequest("/api/health"));
	handler.cancel();
	expect(observed?.aborted).toBe(true);
	expect((await request).status).toBe(502);
});
