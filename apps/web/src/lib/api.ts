/**
 * @file 前端访问独立服务端的 Eden 入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：lib/auth.ts。
 * 调用：@elysiajs/eden、server、env。
 * 功能：仅以类型引入 App，并配置请求携带会话 Cookie。
 * 预期结果：浏览器包不包含服务端运行时代码。
 */
import { treaty } from "@elysiajs/eden";
import { DESKTOP_ORIGIN } from "@leonwillow-electron/desktop-bridge";
import type { App } from "server/app";
import { ENV } from "@/env";

// 桌面从本地协议访问 API，主进程按用户选择的服务器转发并隔离会话。
// 开发网页保留同源代理；生产网页继续使用公开环境配置。
const serverUrl =
	window.location.protocol === "aidesk:"
		? DESKTOP_ORIGIN
		: import.meta.env.DEV && window.location.protocol !== "file:"
			? window.location.origin
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
