/**
 * @file 请求级的认证服务绑定。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：apps/server/src/modules/auth/index.ts。
 * 调用：@leonwillow-electron/auth、elysia、./http、./model、./response。
 * 功能：通过 Elysia 宏把请求与响应头绑定到四个认证操作。
 * 预期结果：请求之间不共享可变上下文，缺少认证实例时返回 503。
 */
import type { Auth } from "@leonwillow-electron/auth";
import { Elysia, status } from "elysia";
import { requestBetterAuth } from "./http";
import type { AuthError, LoginInput, RegisterInput } from "./model";
import { logoutAuthResponse, userAuthResponse } from "./response";

/**
 * 将请求、真实客户端地址和响应头绑定到当前请求的认证操作。
 * @param auth 共享认证实例；不把请求相关状态存入实例或模块全局变量。
 * @returns authClient 宏；路由显式启用后才解析认证依赖。
 */
export const authService = (auth?: Auth) =>
	new Elysia({ name: "Auth.Service" }).macro("authClient", {
		resolve({ request, server, set }) {
			if (!auth) {
				const error: AuthError = {
					code: "AUTH_UNAVAILABLE",
					message: "认证服务尚未配置。",
				};
				return status(503, error);
			}
			const options = {
				auth,
				request,
				clientIp: server?.requestIP(request)?.address,
			};
			return {
				authClient: {
					register(body: RegisterInput) {
						const username = body.username.trim();
						return userAuthResponse(
							requestBetterAuth({
								...options,
								path: "/sign-up/email",
								body: {
									username,
									name: username,
									password: body.password,
									// 内部邮箱不要求用户提供，不向用户展示或发送邮件。
									email: `${username.toLowerCase()}@leonwillow.com`,
									rememberMe: false,
								},
							}),
							"/sign-up/email",
							set.headers,
						);
					},
					login: (body: LoginInput) =>
						userAuthResponse(
							requestBetterAuth({
								...options,
								path: "/sign-in/username",
								body: { ...body, username: body.username.trim() },
							}),
							"/sign-in/username",
							set.headers,
						),
					session: () =>
						userAuthResponse(
							requestBetterAuth({ ...options, path: "/get-session" }),
							"/get-session",
							set.headers,
						),
					logout: () =>
						logoutAuthResponse(
							requestBetterAuth({ ...options, path: "/sign-out", body: {} }),
							set.headers,
						),
				},
			};
		},
	});
