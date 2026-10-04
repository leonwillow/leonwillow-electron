/**
 * @file 认证工作区的运行时工厂出口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：服务端认证基础层，随工作区维护。
 * 被调用：scripts、packages/auth/src、apps/server/test、apps/server/src、apps/server/src/modules/auth。
 * 调用：@better-auth/drizzle-adapter、@leonwillow-electron/db、better-auth、./config。
 * 功能：把部署参数与数据库适配器注入共用 Better Auth 配置。
 * 预期结果：实例由应用创建，包本身无监听和环境加载副作用。
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Database } from "@leonwillow-electron/db";
import * as schema from "@leonwillow-electron/db/schema";
import { betterAuth } from "better-auth";
import { authOptions } from "./config";

/**
 * 将数据库和部署配置注入共用认证规则。
 * @param options db 由调用方持有；secret 用于签名，baseURL 为服务地址，trustedOrigins 为前端来源。
 * @returns Better Auth 实例；不自行监听或初始化管理员。
 */
export function createAuth(options: {
	db: Database;
	secret: string;
	baseURL: string;
	trustedOrigins: string[];
}) {
	return betterAuth({
		...authOptions,
		database: drizzleAdapter(options.db, { provider: "pg", schema }),
		secret: options.secret,
		baseURL: options.baseURL,
		trustedOrigins: options.trustedOrigins,
	});
}

export type Auth = ReturnType<typeof createAuth>;
