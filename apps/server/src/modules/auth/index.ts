/**
 * @file 账号接口的 HTTP 边界。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：apps/server/src/app.ts。
 * 调用：@leonwillow-electron/auth、elysia、./model、./service。
 * 功能：注册路由、命名模型、来源检查和统一错误处理。
 * 预期结果：Eden 从同一组路由推导请求与响应契约。
 */
import type { Auth } from "@leonwillow-electron/auth";
import { Elysia, status } from "elysia";
import { type AuthError, AuthModel, authResponses } from "./model";
import { authService } from "./service";

const userResponseSchema = authResponses("auth.UserResponse");

/**
 * 注册账号接口，并在模块内统一处理来源限制和校验错误。
 * @param auth 认证实例；未配置时由 authClient 宏返回 503。
 * @param origins 允许发起 POST 的 Origin 白名单。
 * @returns 带命名模型和请求级认证服务的 Elysia 插件。
 */
export const authModule = (auth: Auth | undefined, origins: string[]) =>
	new Elysia({ name: "auth", prefix: "/api/auth" })
		.model(AuthModel)
		.prefix("model", "auth.")
		.use(authService(auth))
		.onBeforeHandle(({ request }) => {
			if (
				request.method === "POST" &&
				!origins.includes(request.headers.get("origin") ?? "")
			) {
				const error: AuthError = {
					code: "INVALID_ORIGIN",
					message: "当前页面来源未获允许，请检查服务端配置。",
				};
				return status(403, error);
			}
		})
		.onError(({ code }) => {
			if (code === "VALIDATION") {
				const error: AuthError = {
					code: "VALIDATION_ERROR",
					message: "请检查账号、密码和条款确认。",
				};
				return status(422, error);
			}
			console.error("认证请求失败：", code);
			const error: AuthError = {
				code: "AUTH_FAILED",
				message: "认证服务暂时不可用，请稍后再试。",
			};
			return status(500, error);
		})
		/**
		 * POST /api/auth/register：接收账号、8～128 位密码和 agreeToTerms=true。
		 * 成功返回 200、公开用户资料及会话 Cookie；账号冲突/格式错误返回 400。
		 * 公共错误：403 来源拒绝、422 校验失败、429 限流、500 服务异常、503 未配置。
		 */
		.post("/register", ({ body, authClient }) => authClient.register(body), {
			authClient: true,
			body: "auth.Register",
			response: userResponseSchema,
		})
		/**
		 * POST /api/auth/login：接收账号、密码及 rememberMe。
		 * 成功返回 200、公开资料及 Cookie；rememberMe 决定 Cookie 是否持久化，凭据错误返回 401。
		 * 公共错误：403 来源拒绝、422 校验失败、429 限流、500 服务异常、503 未配置。
		 */
		.post("/login", ({ body, authClient }) => authClient.login(body), {
			authClient: true,
			body: "auth.Login",
			response: userResponseSchema,
		})
		/**
		 * GET /api/auth/session：从 Cookie 检查数据库会话，无请求体。
		 * 有效会话返回 200 和公开资料；缺失、失效或被撤销的会话返回 401。
		 * 公共错误：429 限流、500 服务异常、503 未配置。
		 */
		.get("/session", ({ authClient }) => authClient.session(), {
			authClient: true,
			response: userResponseSchema,
		})
		/**
		 * POST /api/auth/logout：读取会话 Cookie，无请求体。
		 * 成功撤销服务端会话并清除 Cookie，返回 200 和 { success: true }。
		 * 公共错误：403 来源拒绝、429 限流、500 服务异常、503 未配置。
		 */
		.post("/logout", ({ authClient }) => authClient.logout(), {
			authClient: true,
			response: authResponses("auth.LogoutResponse"),
		});
