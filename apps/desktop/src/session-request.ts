/**
 * @file 使用隔离的 Chromium 会话访问指定后端。
 * 创建时间：2026-11-10；修改时间：2026-11-21。
 * 被调用：main/protocol-handler；调用：Electron net.request 和 session-request-core。
 * 功能：原生存取同站 Cookie、转发二进制流、捕获非标响应头异常并支持中止，不向页面暴露 Cookie。
 * 预期结果：本地页面 Origin 与后端网络站点分开处理，畸形上游响应仅拒绝当前请求而不崩溃主进程。
 */
import { net, type Session } from "electron";
import { executeSessionRequest } from "./session-request-core";

/**
 * 仅由已验证来源的协议代理调用，url 必须属于本 session 对应的后端。
 * 网络站点使用后端 origin，HTTP Origin 仍由调用方固定为本地应用来源。
 * Chromium 管理 Cookie；重定向拒绝，取消传播到网络和响应体。
 */
export function sessionRequest(
	network: Session,
	url: string,
	options: RequestInit,
): Promise<Response> {
	return executeSessionRequest(
		(requestOptions) => net.request(requestOptions),
		network,
		url,
		options,
	);
}
