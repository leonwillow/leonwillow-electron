/**
 * @file 桌面会话请求执行内核与响应转换。
 * 创建时间：2026-11-21；修改时间：2026-11-21。
 * 被调用：session-request.ts、session-request.test.ts；调用：node:stream 与注入的 ClientRequest 工厂。
 * 功能：转发请求、将 IncomingMessage 转为 Fetch Response，并在 response 事件中捕获非标响应头/状态码异常。
 * 预期结果：异常响应不会成为主进程 uncaughtException，及时销毁流、中止请求并拒绝 Promise。
 */
import { Readable } from "node:stream";
import type {
	ClientRequest,
	ClientRequestConstructorOptions,
	Session,
} from "electron";

export type IncomingResponseLike = Readable & {
	rawHeaders: string[];
	statusCode: number;
	statusMessage: string;
};

export type RequestFactory = (
	options: ClientRequestConstructorOptions,
) => ClientRequest;

/**
 * 将 Electron IncomingMessage 转为 Fetch Response；非标响应头或越界状态码时抛出异常供调用方清理。
 * @param response Electron 原始响应对象。
 * @param method 请求方法（用于判定无正文响应）。
 * @returns 可直接流式转发的 Web Response。
 * @throws 非 Latin-1/非法响应头名或越界 HTTP 状态码时抛出 TypeError/RangeError。
 */
export function buildSessionResponse(
	response: IncomingResponseLike,
	method: string,
): Response {
	const headers = new Headers();
	for (let index = 0; index < response.rawHeaders.length; index += 2) {
		const name = response.rawHeaders[index];
		const value = response.rawHeaders[index + 1];
		if (name && value !== undefined) headers.append(name, value);
	}
	const empty =
		method.toUpperCase() === "HEAD" ||
		[204, 205, 304].includes(response.statusCode);
	if (empty) response.resume();
	return new Response(
		empty ? null : (Readable.toWeb(response) as ReadableStream<Uint8Array>),
		{
			status: response.statusCode,
			statusText: response.statusMessage,
			headers,
		},
	);
}

/**
 * 执行带会话隔离和取消传播的 HTTP 请求，确保 response 回调内所有构造错误都安全转化为 Promise rejection。
 */
export async function executeSessionRequest(
	createRequest: RequestFactory,
	network: Session,
	url: string,
	options: RequestInit,
): Promise<Response> {
	options.signal?.throwIfAborted();
	const body =
		options.body instanceof ArrayBuffer
			? Buffer.from(options.body)
			: options.body
				? Buffer.from(await new Response(options.body).arrayBuffer())
				: undefined;
	options.signal?.throwIfAborted();
	const method = options.method ?? "GET";
	return new Promise<Response>((resolve, reject) => {
		let settled = false;
		let incoming: Readable | undefined;
		const settleResolve = (value: Response) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		const settleReject = (error: unknown) => {
			if (settled) return;
			settled = true;
			reject(error);
		};
		const request = createRequest({
			url,
			method,
			session: network,
			origin: new URL(url).origin,
			headers: Object.fromEntries(new Headers(options.headers)),
			credentials: options.credentials ?? "include",
			redirect: "error",
			cache: "no-store",
		});
		const abort = () => {
			const reason = options.signal?.reason ?? new Error("请求已取消。");
			incoming?.destroy(reason instanceof Error ? reason : undefined);
			request.abort();
			settleReject(reason);
		};
		options.signal?.addEventListener("abort", abort, { once: true });
		const cleanup = () => options.signal?.removeEventListener("abort", abort);
		request.on("error", (error) => {
			cleanup();
			settleReject(error);
		});
		request.on("response", (response) => {
			// Electron IncomingMessage 运行时继承 Node Readable，公开类型仅声明事件方法。
			const stream = response as unknown as IncomingResponseLike;
			incoming = stream;
			stream.once("end", cleanup);
			stream.once("close", cleanup);
			stream.once("error", cleanup);
			try {
				settleResolve(buildSessionResponse(stream, method));
			} catch (error) {
				cleanup();
				stream.destroy();
				request.abort();
				settleReject(
					error instanceof Error
						? error
						: new Error("上游响应头或状态码无效。"),
				);
			}
		});
		if (options.signal?.aborted) abort();
		else request.end(body);
	});
}
