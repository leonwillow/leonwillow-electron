/**
 * @file 账号接口的 HTTP 边界。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-05
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：apps/server/src/app.ts。
 * 调用：server-resources、elysia、./model、./http、./response。
 * 功能：注册路由、命名模型、来源检查和统一错误处理。
 * 预期结果：Eden 从同一组路由推导请求与响应契约。
 */
import { Elysia, status } from "elysia";
import {
	isTrustedOrigin,
	ServerResourcesUnavailableError,
} from "../../server-resources";
import { requestBetterAuth } from "./http";
import { type AuthError, AuthModel, authResponses } from "./model";
import { logoutAuthResponse, userAuthResponse } from "./response";

const userResponseSchema = authResponses("auth.UserResponse");

/**
 * 注册账号接口，并在模块内统一处理来源限制和校验错误。
 * 直接注册命名插件；安全配置由共享资源提供，认证未初始化时返回 503。
 */
export const authModule = new Elysia({ name: "auth", prefix: "/api/auth" })
	.model(AuthModel)
	.prefix("model", "auth.")
	.onRequest(({ set }) => {
		set.headers["x-request-id"] = crypto.randomUUID();
	})
	.onBeforeHandle(({ request }) => {
		if (request.method === "POST" && !isTrustedOrigin(request)) {
			const error: AuthError = {
				code: "INVALID_ORIGIN",
				message: "当前页面来源未获允许，请检查服务端配置。",
			};
			return status(403, error);
		}
	})
	.onError(({ code, error, request, set }) => {
		if (error instanceof ServerResourcesUnavailableError)
			return status(503, {
				code: "AUTH_UNAVAILABLE",
				message: "认证服务尚未配置。",
			} satisfies AuthError);
		if (code === "PARSE")
			return status(400, {
				code: "INVALID_JSON",
				message: "请求 JSON 格式无效。",
			} satisfies AuthError);
		if (code === "VALIDATION" && error.type !== "response") {
			const error: AuthError = {
				code: "VALIDATION_ERROR",
				message: "请检查账号、密码和条款确认。",
			};
			return status(422, error);
		}
		// 不记录异常消息和首行 stack，避免依赖错误携带 SQL、请求体或凭据。
		console.error("认证请求失败：", {
			code,
			requestId: set.headers["x-request-id"],
			path: new URL(request.url).pathname,
			errorName: error instanceof Error ? error.name : "UnknownError",
			stack:
				error instanceof Error
					? error.stack?.split("\n").filter((line) => /^\s+at /.test(line))
					: undefined,
		});
		const response: AuthError = {
			code: "AUTH_FAILED",
			message: "认证服务暂时不可用，请稍后再试。",
		};
		return status(500, response);
	})
	/**
	 * POST /api/auth/register：保留旧客户端地址，始终拒绝公开注册。
	 * 返回 403，管理员必须通过人员管理创建账号；不创建会话。
	 */
	.post(
		"/register",
		() =>
			status(403, {
				code: "REGISTRATION_CLOSED",
				message: "系统不开放自行注册，请联系管理员创建账号。",
			}),
		{
			body: "auth.Register",
			response: userResponseSchema,
		},
	)
	/**
	 * POST /api/auth/login：接收账号、密码及 rememberMe。
	 * 成功返回 200、公开资料及 Cookie；rememberMe 决定 Cookie 是否持久化，凭据错误返回 401。
	 * 公共错误：403 来源拒绝、422 校验失败、429 限流、500 服务异常、503 未配置。
	 */
	.post(
		"/login",
		({ body, request, server, set }) =>
			userAuthResponse(
				requestBetterAuth({
					request,
					peerIp: server?.requestIP(request)?.address,
					path: "/sign-in/username",
					body: { ...body, username: body.username.trim() },
				}),
				"/sign-in/username",
				set.headers,
			),
		{
			body: "auth.Login",
			response: userResponseSchema,
		},
	)
	/**
	 * GET /api/auth/session：从 Cookie 检查数据库会话，无请求体。
	 * 有效会话返回 200 和公开资料；缺失、失效或被撤销的会话返回 401。
	 * 公共错误：429 限流、500 服务异常、503 未配置。
	 */
	.get(
		"/session",
		({ request, server, set }) =>
			userAuthResponse(
				requestBetterAuth({
					request,
					peerIp: server?.requestIP(request)?.address,
					path: "/get-session",
				}),
				"/get-session",
				set.headers,
			),
		{ response: userResponseSchema },
	)
	/**
	 * POST /api/auth/logout：读取会话 Cookie，无请求体。
	 * 成功撤销服务端会话并清除 Cookie，返回 200 和 { success: true }。
	 * 公共错误：403 来源拒绝、429 限流、500 服务异常、503 未配置。
	 */
	.post(
		"/logout",
		({ request, server, set }) =>
			logoutAuthResponse(
				requestBetterAuth({
					request,
					peerIp: server?.requestIP(request)?.address,
					path: "/sign-out",
					body: {},
				}),
				set.headers,
			),
		{ response: authResponses("auth.LogoutResponse") },
	);
