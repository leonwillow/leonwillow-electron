/**
 * @file 前端访问独立服务端的 Eden 入口与统一响应解包工具。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现，统一携带状态码的请求错误与解包逻辑。
 * 被调用：apps/web/src/lib/* 各领域 API 客户端。
 * 调用：@elysiajs/eden、@leonwillow-electron/desktop-bridge、server/app（仅类型）、@/env。
 * 功能：创建带 Cookie 凭据的 Eden 客户端，并提供统一的错误类与响应解包辅助函数。
 * 预期结果：浏览器包不包含服务端运行时代码，各业务客户端共享一致的中文错误处理。
 */
import { treaty } from "@elysiajs/eden";
import { DESKTOP_ORIGIN } from "@leonwillow-electron/desktop-bridge";
import type { App } from "server/app";
import { ENV } from "@/env";

// 桌面从本地协议访问 API，主进程按用户选择的服务器转发并隔离会话。
// 开发网页保留同源代理；生产网页继续使用公开环境配置。
const browserLocation =
	typeof window !== "undefined" ? window.location : undefined;
const serverUrl =
	browserLocation?.protocol === "aidesk:"
		? DESKTOP_ORIGIN
		: import.meta.env.DEV && browserLocation
			? browserLocation.origin
			: ENV.VITE_SERVER_URL;

export const api = treaty<App>(serverUrl, {
	fetch: { credentials: "include" },
	// 保留银行 ISO 时间与原文字段，避免客户端自动把日期字符串转成 Date。
	parseDate: false,
	// Eden 默认按文本解析 DOCX；在解析前保留二进制，避免压缩字节被 UTF-8 解码损坏。
	onResponse: (response) =>
		response.ok &&
		response.headers
			.get("content-type")
			?.startsWith(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			)
			? response.blob()
			: undefined,
});

/** 保留服务端 HTTP 状态码的客户端请求错误，供 401/403/404/409 分支判断使用。 */
export class ApiRequestError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

/**
 * 统一解包 Eden 响应：优先提取服务端返回的结构化 message，并保留 HTTP 状态码。
 * @param result Eden 请求返回对象。
 * @param fallbackError 服务端未提供可读 message 时的兜底错误文案。
 * @param emptyError data 为 null 时的错误文案。
 */
export function unwrapApi<T>(
	result: {
		data: T | null;
		error: { value: unknown; status?: number } | null;
	},
	fallbackError = "请求失败，请稍后重试。",
	emptyError = "服务未返回有效结果。",
): T {
	if (result.error) {
		const value = result.error.value;
		const message =
			typeof value === "object" &&
			value !== null &&
			"message" in value &&
			typeof value.message === "string"
				? value.message
				: fallbackError;
		throw new ApiRequestError(message, result.error.status ?? 500);
	}
	if (result.data === null) throw new Error(emptyError);
	return result.data;
}

/** 提取异常可读消息，非 Error 对象回退到业务指定的服务连接提示。 */
export function apiErrorMessage(error: unknown, fallbackMessage: string) {
	return error instanceof Error ? error.message : fallbackMessage;
}
