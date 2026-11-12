/**
 * @file 桌面资源路径、IPC 来源及 API 代理头的边界。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：纯函数供主进程与 Bun 回归测试复用。
 * 被调用：main/protocol-handler；调用：desktop-bridge 和 Node path。
 * 预期结果：只能读取打包资源和当前服务器 API，renderer 不能指定凭据或代理来源头。
 */
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { DESKTOP_ORIGIN } from "@leonwillow-electron/desktop-bridge";

/** 规范化服务器地址由连接存储传入；端口也参与隔离，不在目录名暴露地址。 */
export function networkPartition(url: string) {
	return `persist:api-${createHash("sha256").update(url).digest("hex")}`;
}

export function isAppUrl(value: string, loginOnly = false) {
	try {
		const url = new URL(value);
		return (
			`${url.protocol}//${url.host}` === DESKTOP_ORIGIN &&
			!url.username &&
			!url.password &&
			(!loginOnly || url.pathname === "/login")
		);
	} catch {
		return false;
	}
}

/** 返回资源根目录内的路径；编码斜线、NUL 和越界路径均拒绝。 */
export function rendererFile(root: string, pathname: string) {
	if (/%(?:2f|5c|00)/i.test(pathname)) return null;
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (decoded.includes("\\") || decoded.includes("\0")) return null;
	const target = resolve(root, `.${decoded}`);
	const child = relative(root, target);
	return child.startsWith("..") || isAbsolute(child) ? null : target;
}

/** 仅转发业务需要的头；Cookie 由独立 Electron 网络会话维护。 */
export function upstreamHeaders(input: Headers) {
	const headers = new Headers();
	for (const key of [
		"accept",
		"content-type",
		"if-match",
		"if-none-match",
		"range",
	])
		if (input.has(key)) headers.set(key, input.get(key) as string);
	headers.set("origin", DESKTOP_ORIGIN);
	return headers;
}

/** 去除已被 Chromium 消费的 Cookie 和网络传输头，保留下载及公开错误响应。 */
export function rendererHeaders(input: Headers) {
	const headers = new Headers(input);
	for (const key of [
		"set-cookie",
		"content-length",
		"content-encoding",
		"transfer-encoding",
		"connection",
		"keep-alive",
		"access-control-allow-origin",
		"access-control-allow-credentials",
	])
		headers.delete(key);
	headers.set("cache-control", "no-store");
	return headers;
}
