/**
 * @file 桌面静态资源与受控 API 转发。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：本地前端与远端 API 分离，Cookie 只存于各服务器独立的 Chromium 会话。
 * 被调用：main；调用：Node fs/path、请求边界函数和主进程注入的网络会话。
 * 预期结果：不加载远程页面代码，不泄露服务器 Cookie；切换服务器可中止旧请求。
 */
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { DESKTOP_ORIGIN } from "@leonwillow-electron/desktop-bridge";
import {
	isAppUrl,
	rendererFile,
	rendererHeaders,
	upstreamHeaders,
} from "./request-policy";

const mimeTypes: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
};

export type ApiTarget = {
	url: string;
	fetch: (url: string, options: RequestInit) => Promise<Response>;
};

/** 主进程 owns controllers；返回cancel使保存配置先取消旧请求，响应不会混入新服务器会话。 */
export function createProtocolHandler(options: {
	rendererRoot: string;
	getTarget: () => ApiTarget;
}) {
	const pending = new Set<AbortController>();
	return {
		cancel() {
			for (const controller of pending) controller.abort();
			pending.clear();
		},
		async handle(
			request: Request & { initiatorOrigin?: string },
		): Promise<Response> {
			if (!isAppUrl(request.url))
				return new Response("Not found", { status: 404 });
			const url = new URL(request.url);
			if (url.pathname.startsWith("/api/")) {
				if (request.initiatorOrigin !== DESKTOP_ORIGIN)
					return new Response("Forbidden", { status: 403 });
				const target = options.getTarget();
				const controller = new AbortController();
				pending.add(controller);
				const timeout = setTimeout(() => controller.abort(), 180_000);
				const finish = () => {
					clearTimeout(timeout);
					pending.delete(controller);
				};
				controller.signal.addEventListener("abort", finish, { once: true });
				try {
					const response = await target.fetch(
						`${target.url}${url.pathname}${url.search}`,
						{
							method: request.method,
							headers: upstreamHeaders(request.headers),
							body: ["GET", "HEAD"].includes(request.method)
								? undefined
								: await request.arrayBuffer(),
							credentials: "include",
							redirect: "error",
							signal: AbortSignal.any([controller.signal, request.signal]),
						},
					);
					const reader = response.body?.getReader();
					// 控制器持续到响应体读完；大文件无需整体缓存，切换服务器仍能中止流。
					const body = reader
						? new ReadableStream<Uint8Array>({
								async pull(output) {
									try {
										controller.signal.throwIfAborted();
										const chunk = await reader.read();
										controller.signal.throwIfAborted();
										if (chunk.done) {
											finish();
											output.close();
										} else output.enqueue(chunk.value);
									} catch (error) {
										finish();
										output.error(error);
									}
								},
								async cancel(reason) {
									controller.abort();
									finish();
									await reader.cancel(reason);
								},
							})
						: null;
					if (!body) finish();
					return new Response(body, {
						status: response.status,
						statusText: response.statusText,
						headers: rendererHeaders(response.headers),
					});
				} catch {
					finish();
					return Response.json(
						{ message: "无法连接服务器，请检查登录页的服务器设置和网络连接。" },
						{ status: 502 },
					);
				}
			}
			if (!["GET", "HEAD"].includes(request.method))
				return new Response("Method not allowed", { status: 405 });
			if (request.initiatorOrigin && request.initiatorOrigin !== DESKTOP_ORIGIN)
				return new Response("Forbidden", { status: 403 });
			const target = rendererFile(options.rendererRoot, url.pathname);
			if (!target) return new Response("Not found", { status: 404 });
			try {
				const file =
					!extname(target) || (await stat(target)).isDirectory()
						? join(options.rendererRoot, "index.html")
						: target;
				const type = mimeTypes[extname(file)] ?? "application/octet-stream";
				const headers = new Headers({
					"content-type": type,
					"x-content-type-options": "nosniff",
				});
				if (extname(file) === ".html") {
					headers.set(
						"content-security-policy",
						"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
					);
					headers.set("cache-control", "no-store");
				}
				return new Response(
					request.method === "HEAD" ? null : await readFile(file),
					{ headers },
				);
			} catch {
				return new Response("Not found", { status: 404 });
			}
		},
	};
}
