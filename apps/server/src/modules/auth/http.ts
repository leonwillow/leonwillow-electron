/**
 * @file Better Auth 内部 HTTP 调用适配。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：apps/server/src/modules/auth/response.ts、apps/server/src/modules/auth/service.ts。
 * 调用：@leonwillow-electron/auth。
 * 功能：保留 Cookie/Origin 并重建白名单端点请求，注入可信客户端地址。
 * 预期结果：认证库的限流与会话逻辑仍经过完整 handler。
 */
import type { Auth } from "@leonwillow-electron/auth";

export type AuthEndpoint =
	| "/sign-up/email"
	| "/sign-in/username"
	| "/get-session"
	| "/sign-out";

/**
 * 将公开账号操作转换为 Better Auth 内部 HTTP 请求，继续经过库的限流和来源检查。
 * @param options 原请求提供 Cookie/Origin；path 只允许白名单端点，body 存在时使用 POST。
 * options.clientIp 必须来自监听器，转发前删除客户端伪造的同名地址头。
 * @returns 原始认证响应；Cookie 和公开数据由 response.ts 处理。
 */
export function requestBetterAuth(options: {
	auth: Auth;
	request: Request;
	path: AuthEndpoint;
	body?: object;
	clientIp?: string;
}) {
	const { auth, request, path, body, clientIp } = options;
	const url = new URL(request.url);
	url.pathname = `/api/auth${path}`;
	url.search = "";
	const headers = new Headers(request.headers);
	headers.delete("content-length");
	// 只使用监听服务获取的地址，客户端传来的同名头不能伪造限流来源。
	headers.delete("x-leonwillow-client-ip");
	if (clientIp) headers.set("x-leonwillow-client-ip", clientIp);
	if (body) headers.set("content-type", "application/json");
	return auth.handler(
		new Request(url.toString(), {
			method: body ? "POST" : "GET",
			headers,
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}
