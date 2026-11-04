/**
 * @file 独立于启动流程的 HTTP 应用工厂。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-04
 * 版本作用：Web 与未来桌面客户端共用的 HTTP 契约入口。
 * 被调用：apps/server/test/auth.test.ts、apps/server/test/health.test.ts、apps/server/src/index.ts。
 * 调用：@elysiajs/cors、elysia、业务模块实例、共用来源校验。
 * 功能：装配 CORS、健康检查、认证和人员权限模块并导出 Eden 契约。
 * 预期结果：调用工厂不会监听或读取环境；公共健康检查无需数据库。
 */
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { accessModule } from "./modules/access";
import { adminModule } from "./modules/admin";
import { authModule } from "./modules/auth";
import { documentsModule } from "./modules/documents";
import { fundsModule } from "./modules/funds";
import { inquiriesModule } from "./modules/inquiries";
import { isTrustedOrigin } from "./server-resources";

/**
 * 组装 HTTP 应用，不加载环境、不连接数据库，也不监听端口。
 * 业务模块直接使用启动时绑定的共用资源；未绑定时认证和权限接口返回 503。
 * @returns 可供 Bun 监听或 Eden 直接测试的 Elysia 实例。
 */
export const createApp = () =>
	new Elysia()
		.use(
			cors({
				origin: isTrustedOrigin,
				credentials: true,
			}),
		)
		/** GET /api/health：无需参数或会话，返回 200 和服务标识；不探测数据库。 */
		.get(
			"/api/health",
			() => ({ status: "ok", service: "leonwillow-electron" }) as const,
		)
		.use(authModule)
		.use(accessModule)
		.use(adminModule)
		.use(fundsModule)
		.use(documentsModule)
		.use(inquiriesModule);

export type App = ReturnType<typeof createApp>;
