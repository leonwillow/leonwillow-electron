/**
 * @file 账号接口的运行时校验模型。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-05
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：认证路由、响应适配、认证响应测试。
 * 调用：elysia。
 * 功能：定义输入、公开用户与错误结构，并推导 TypeScript 类型。
 * 预期结果：服务端验证与客户端类型来自同一份模型。
 */
import { t } from "elysia";

const user = t.Object({
	id: t.String(),
	username: t.String(),
	name: t.String(),
	image: t.Nullable(t.String()),
	role: t.Union([t.Literal("admin"), t.Literal("user")]),
});

export const AuthModel = {
	register: t.Object({
		username: t.String({ minLength: 1, maxLength: 64 }),
		password: t.String({ minLength: 8, maxLength: 128 }),
		agreeToTerms: t.Literal(true),
	}),
	login: t.Object({
		username: t.String({ minLength: 1, maxLength: 64 }),
		password: t.String({ minLength: 5, maxLength: 128 }),
		rememberMe: t.Boolean(),
	}),
	userResponse: t.Object({ user }),
	logoutResponse: t.Object({ success: t.Literal(true) }),
	error: t.Object({ code: t.String(), message: t.String() }),
};

export type RegisterInput = typeof AuthModel.register.static;
export type LoginInput = typeof AuthModel.login.static;
export type UserResponse = typeof AuthModel.userResponse.static;
export type LogoutResponse = typeof AuthModel.logoutResponse.static;
export type AuthError = typeof AuthModel.error.static;

/**
 * 为账号接口组合成功模型和共用错误模型，保留状态码的字面量类型供 Eden 推导。
 * @param success 已注册且带 auth. 前缀的成功响应模型名。
 * @returns HTTP 状态码到模型名称的映射。
 */
export const authResponses = <
	const Success extends "auth.UserResponse" | "auth.LogoutResponse",
>(
	success: Success,
) =>
	({
		200: success,
		400: "auth.Error",
		401: "auth.Error",
		403: "auth.Error",
		422: "auth.Error",
		429: "auth.Error",
		500: "auth.Error",
		503: "auth.Error",
	}) as const;
