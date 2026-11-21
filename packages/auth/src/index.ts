/**
 * @file 认证工作区的运行时工厂出口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：服务端认证基础层，随工作区维护。
 * 被调用：scripts、packages/auth/src、apps/server/test、apps/server/src、apps/server/src/modules/auth、apps/server/src/modules/access。
 * 调用：@better-auth/drizzle-adapter、@leonwillow-electron/db、better-auth、./config。
 * 功能：把部署参数与数据库适配器注入共用 Better Auth 配置，并提供 APIError 解析工具。
 * 预期结果：实例由应用创建，包本身无监听和环境加载副作用。
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Database, DatabaseTransaction } from "@leonwillow-electron/db";
import * as schema from "@leonwillow-electron/db/schema";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { authOptions } from "./config";

/**
 * 将数据库和部署配置注入共用认证规则。
 * @param options db 由调用方持有；secret 用于签名，baseURL 为服务地址，trustedOrigins 为网站来源或其读取函数。
 * @returns Better Auth 实例；不自行监听或初始化管理员。
 */
export function createAuth(options: {
	db: Database;
	secret: string;
	baseURL: string;
	trustedOrigins: string[] | (() => string[]);
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

/**
 * 将现有认证配置绑定到管理事务；调用方必须先验证管理员会话。
 * @param auth 应用认证配置，不复用请求上下文。
 * @param db 当前管理事务，所有账号、凭据与审计写入共用事务。
 * @returns 同配置的认证实例；事务回滚时账号操作一并撤销。
 */
export function authInTransaction(auth: Auth, db: DatabaseTransaction) {
	return betterAuth({
		...auth.options,
		database: drizzleAdapter(db, { provider: "pg", schema }),
	});
}

export type AuthApiErrorInfo = {
	statusCode: number;
	code: string;
	setCookies: string[];
};

/** 识别 Better Auth APIError 并提取 HTTP 状态码、错误码与待透传的 Set-Cookie 头。 */
export function readAuthApiError(error: unknown): AuthApiErrorInfo | null {
	if (!(error instanceof APIError)) return null;
	const statusCode =
		typeof error.statusCode === "number" && error.statusCode >= 400
			? error.statusCode
			: 500;
	const code =
		typeof error.body?.code === "string" && error.body.code
			? error.body.code
			: typeof error.status === "string"
				? error.status
				: "AUTH_ERROR";
	let setCookies: string[] = [];
	const rawHeaders = error.headers;
	if (rawHeaders instanceof Headers) {
		setCookies = rawHeaders.getSetCookie();
	} else if (rawHeaders && typeof rawHeaders === "object") {
		const normalized = new Headers();
		for (const [key, value] of Object.entries(rawHeaders)) {
			if (Array.isArray(value)) {
				for (const item of value) normalized.append(key, String(item));
			} else if (value !== undefined) {
				normalized.append(key, String(value));
			}
		}
		setCookies = normalized.getSetCookie();
	}
	return { statusCode, code, setCookies };
}
