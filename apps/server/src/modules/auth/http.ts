/**
 * @file Better Auth 内部 HTTP 调用适配。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-05
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：auth 路由与响应适配的端点类型。
 * 调用：server-resources 中已初始化的认证实例与代理配置、client-ip。
 * 功能：保留 Cookie/Origin 并重建白名单端点请求，注入可信客户端地址。
 * 预期结果：认证库的限流与会话逻辑仍经过完整 handler。
 */
import { getServerResources, getTrustedProxyIps } from "../../server-resources";
import { getClientIp } from "./client-ip";

export type AuthEndpoint =
	| "/sign-up/email"
	| "/sign-in/username"
	| "/get-session"
	| "/sign-out";

/**
 * 将公开账号操作转换为 Better Auth 内部 HTTP 请求，继续经过库的限流和来源检查。
 * @param options 原请求提供 Cookie/Origin；path 只允许白名单端点，body 存在时使用 POST。
 * options.peerIp 必须来自监听器；本函数按受信代理配置解析客户端地址，并删除伪造头。
 * @returns 原始认证响应；Cookie 和公开数据由 response.ts 处理。
 * @throws 认证未初始化或库调用失败时抛出异常，由路由错误边界映射为 503/500。
 */
export function requestBetterAuth(options: {
	request: Request;
	path: AuthEndpoint;
	body?: object;
	peerIp?: string;
}) {
	const { auth } = getServerResources();
	const { request, path, body, peerIp } = options;
	const clientIp = getClientIp(request, peerIp, getTrustedProxyIps());
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
