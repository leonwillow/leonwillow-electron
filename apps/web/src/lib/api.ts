/**
 * @file 前端访问独立服务端的 Eden 入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：lib/auth.ts。
 * 调用：@elysiajs/eden、server、env。
 * 功能：仅以类型引入 App，并配置请求携带会话 Cookie。
 * 预期结果：浏览器包不包含服务端运行时代码。
 */
import { treaty } from "@elysiajs/eden";
import type { App } from "server/app";
import { ENV } from "@/env";

// 类型导入会在打包时移除；Web/Electron renderer 共用 Eden 客户端。
export const api = treaty<App>(ENV.VITE_SERVER_URL, {
	fetch: { credentials: "include" },
});
