/**
 * @file 独立于启动流程的 HTTP 应用工厂。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面客户端共用的 HTTP 契约入口。
 * 被调用：apps/server/test/auth.test.ts、apps/server/test/health.test.ts、apps/server/src/index.ts。
 * 调用：@elysiajs/cors、@leonwillow-electron/auth、elysia、./modules/auth。
 * 功能：装配 CORS、健康检查和认证模块并导出 Eden 契约。
 * 预期结果：调用工厂不会监听或读取环境；公共健康检查无需数据库。
 */
import { cors } from "@elysiajs/cors";
import type { Auth } from "@leonwillow-electron/auth";
import { Elysia } from "elysia";
import { authModule } from "./modules/auth";

/**
 * 组装 HTTP 应用，不加载环境、不连接数据库，也不监听端口。
 * @param origin 允许携带 Cookie 的前端来源，支持多个明确来源。
 * @param auth 已初始化的认证实例；省略时认证接口返回 503，健康检查仍可用。
 * @returns 可供 Bun 监听或 Eden 直接测试的 Elysia 实例。
 */
export const createApp = (
	origin: string | string[] = "http://localhost:3001",
	auth?: Auth,
) =>
	new Elysia()
		.use(cors({ origin, credentials: true }))
		/** GET /api/health：无需参数或会话，返回 200 和服务标识；不探测数据库。 */
		.get(
			"/api/health",
			() => ({ status: "ok", service: "leonwillow-electron" }) as const,
		)
		.use(authModule(auth, Array.isArray(origin) ? origin : [origin]));

export type App = ReturnType<typeof createApp>;
