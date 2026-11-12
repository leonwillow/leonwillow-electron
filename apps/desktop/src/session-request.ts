/**
 * @file 使用隔离的 Chromium 会话访问指定后端。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：main/protocol-handler；调用：Electron net.request 和 Node stream。
 * 功能：原生存取同站 Cookie、转发二进制流并支持中止，不向页面暴露 Cookie。
 * 预期结果：本地页面 Origin 与后端网络站点分开处理，SameSite 会话在桌面可用。
 */
import { Readable } from "node:stream";
import { net, type Session } from "electron";

/**
 * 仅由已验证来源的协议代理调用，url 必须属于本 session 对应的后端。
 * 网络站点使用后端 origin，HTTP Origin 仍由调用方固定为本地应用来源。
 * Chromium 管理 Cookie；重定向拒绝，取消传播到网络和响应体。
 */
export async function sessionRequest(
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
	return new Promise<Response>((resolve, reject) => {
		let incoming: Readable | undefined;
		const request = net.request({
			url,
			method: options.method ?? "GET",
			session: network,
			origin: new URL(url).origin,
			headers: Object.fromEntries(new Headers(options.headers)),
			credentials: options.credentials ?? "include",
			redirect: "error",
			cache: "no-store",
		});
		const abort = () => {
			incoming?.destroy(options.signal?.reason ?? new Error("请求已取消。"));
			request.abort();
			reject(options.signal?.reason ?? new Error("请求已取消。"));
		};
		options.signal?.addEventListener("abort", abort, { once: true });
		const cleanup = () => options.signal?.removeEventListener("abort", abort);
		request.on("error", (error) => {
			cleanup();
			reject(error);
		});
		request.on("response", (response) => {
			// Electron IncomingMessage 运行时继承 Node Readable，公开类型仅声明事件方法。
			incoming = response as unknown as Readable;
			incoming.once("end", cleanup);
			incoming.once("close", cleanup);
			incoming.once("error", cleanup);
			const headers = new Headers();
			for (let index = 0; index < response.rawHeaders.length; index += 2) {
				const name = response.rawHeaders[index];
				const value = response.rawHeaders[index + 1];
				if (name && value !== undefined) headers.append(name, value);
			}
			const empty =
				options.method === "HEAD" ||
				[204, 205, 304].includes(response.statusCode);
			if (empty) incoming.resume();
			resolve(
				new Response(
					empty
						? null
						: (Readable.toWeb(incoming) as ReadableStream<Uint8Array>),
					{
						status: response.statusCode,
						statusText: response.statusMessage,
						headers,
					},
				),
			);
		});
		if (options.signal?.aborted) abort();
		else request.end(body);
	});
}
