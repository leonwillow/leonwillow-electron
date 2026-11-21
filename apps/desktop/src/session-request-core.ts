/**
 * @file 桌面会话请求执行内核、流式上传与响应转换。
 * 创建时间：2026-11-21；修改时间：2026-11-21。
 * 被调用：session-request.ts、main.ts、session-request.test.ts；调用：node:stream 与注入的 ClientRequest 工厂。
 * 功能：流式转发请求体、将 IncomingMessage 转为 Fetch Response、有界读取 JSON，并在 response 回调内捕获异常。
 * 预期结果：大文件上传不整包缓冲，异常响应不崩溃主进程，超时/切服及时中止流并释放资源。
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
 * 有界读取 JSON 响应体，防止异常或恶意端点返回超大响应导致主进程内存溢出。
 * @param response Fetch 响应对象。
 * @param maxBytes 允许读取的最大字节数（默认 64 KiB）。
 * @throws 响应体超出上限或 JSON 无效时抛出异常，并取消底层读取流。
 */
export async function readBoundedJson(
	response: Response,
	maxBytes = 64 * 1024,
): Promise<unknown> {
	const declared = Number(response.headers.get("content-length") ?? "");
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel().catch(() => {});
		throw new Error("响应体超出允许大小。");
	}
	if (!response.body) return JSON.parse(await response.text());
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => {});
				throw new Error("响应体超出允许大小。");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const combined = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder("utf-8").decode(combined));
}

/**
 * 执行带会话隔离、流式请求体转发与取消传播的 HTTP 请求，确保 response 回调内所有构造错误安全转化为 rejection。
 */
export async function executeSessionRequest(
	createRequest: RequestFactory,
	network: Session,
	url: string,
	options: RequestInit,
): Promise<Response> {
	options.signal?.throwIfAborted();
	const streamBody =
		typeof ReadableStream !== "undefined" &&
		options.body instanceof ReadableStream
			? (options.body as ReadableStream<Uint8Array>)
			: null;
	const bufferedBody = streamBody
		? undefined
		: options.body instanceof ArrayBuffer
			? Buffer.from(options.body)
			: typeof options.body === "string"
				? Buffer.from(options.body)
				: ArrayBuffer.isView(options.body)
					? Buffer.from(
							options.body.buffer,
							options.body.byteOffset,
							options.body.byteLength,
						)
					: options.body
						? Buffer.from(await new Response(options.body).arrayBuffer())
						: undefined;
	options.signal?.throwIfAborted();
	const method = options.method ?? "GET";
	return new Promise<Response>((resolve, reject) => {
		let settled = false;
		let incoming: Readable | undefined;
		let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
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
		const cancelBodyReader = (reason?: unknown) => {
			if (!bodyReader) return;
			const reader = bodyReader;
			bodyReader = undefined;
			void reader.cancel(reason).catch(() => {});
		};
		const abort = () => {
			const reason = options.signal?.reason ?? new Error("请求已取消。");
			cancelBodyReader(reason);
			incoming?.destroy(reason instanceof Error ? reason : undefined);
			request.abort();
			settleReject(reason);
		};
		options.signal?.addEventListener("abort", abort, { once: true });
		const cleanup = () => options.signal?.removeEventListener("abort", abort);
		request.on("error", (error) => {
			cancelBodyReader(error);
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
				cancelBodyReader(error);
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
		if (options.signal?.aborted) {
			abort();
			return;
		}
		if (streamBody) {
			request.chunkedEncoding = true;
			const reader = streamBody.getReader();
			bodyReader = reader;
			const writeChunk = (chunk: Uint8Array) =>
				new Promise<void>((written) => {
					let finished = false;
					const done = () => {
						if (finished) return;
						finished = true;
						options.signal?.removeEventListener("abort", done);
						written();
					};
					options.signal?.addEventListener("abort", done, { once: true });
					request.write(Buffer.from(chunk), undefined, done);
				});
			void (async () => {
				try {
					for (;;) {
						if (options.signal?.aborted || settled) break;
						const { done, value } = await reader.read();
						if (options.signal?.aborted || settled) break;
						if (done) {
							request.end();
							break;
						}
						if (value && value.byteLength > 0) await writeChunk(value);
					}
				} catch (error) {
					cleanup();
					request.abort();
					settleReject(error);
				} finally {
					if (bodyReader === reader) bodyReader = undefined;
					reader.releaseLock();
				}
			})();
		} else {
			request.end(bufferedBody);
		}
	});
}
