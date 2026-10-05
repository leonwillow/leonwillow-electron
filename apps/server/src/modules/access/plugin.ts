/**
 * @file 受保护 API 共用的 Elysia 权限插件。
 * 创建时间：2026-10-05
 * 修改时间：2026-10-05
 * 版本作用：把 HTTP 会话、来源限制和错误响应接入权限规则。
 * 被调用：access/admin 路由。
 * 调用：Elysia、server-resources、普通权限服务。
 * 功能：解析会话并转交 Cookie，通过 access 宏提供当前请求的身份。
 * 预期结果：校验只作用于使用插件的模块，身份不进入共享状态。
 */
import type { AccessRequirement } from "@leonwillow-electron/access";
import { Elysia, status } from "elysia";
import {
	getServerResources,
	isTrustedOrigin,
	ServerResourcesUnavailableError,
} from "../../server-resources";
import { AccessError, getAccess } from "./service";

/**
 * 直接注册后使用 access: session/admin/功能标识声明权限。
 * 未登录 401、越权/非法来源 403、输入错误 400/422、未初始化 503、内部故障 500。
 * 每次请求重读会话和授权；错误钩子与来源检查仅传播到直接使用该插件的模块。
 */
export const accessPlugin = new Elysia({ name: "Access.Plugin" })
	.onRequest(({ set }) => {
		set.headers["cache-control"] = "no-store";
		set.headers["x-request-id"] = crypto.randomUUID();
	})
	.onBeforeHandle(({ request }) => {
		if (
			!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
			!isTrustedOrigin(request)
		) {
			throw new AccessError(
				403,
				"INVALID_ORIGIN",
				"当前页面来源未获允许，请检查服务端配置。",
			);
		}
	})
	.onError(({ code, error, set }) => {
		if (error instanceof ServerResourcesUnavailableError)
			return status(503, {
				code: "ACCESS_UNAVAILABLE",
				message: "人员与权限服务尚未配置。",
			});
		if (error instanceof AccessError)
			return status(error.statusCode, {
				code: error.code,
				message: error.message,
			});
		if (code === "VALIDATION")
			return status(422, {
				code: "VALIDATION_ERROR",
				message: "提交的内容不符合要求，请检查账号、密码和功能选择。",
			});
		if (code === "PARSE")
			return status(400, {
				code: "INVALID_JSON",
				message: "请求 JSON 格式无效。",
			});
		console.error("权限请求失败：", {
			requestId: set.headers["x-request-id"],
			code,
		});
		return status(500, {
			code: "ACCESS_FAILED",
			message: "人员与权限服务暂时不可用，请稍后重试。",
		});
	})
	.macro("access", (requirement: AccessRequirement) => ({
		async resolve({ request, set }) {
			const { auth } = getServerResources();
			const result = await auth.api.getSession({
				headers: request.headers,
				query: { disableCookieCache: true },
				returnHeaders: true,
			});
			// 后续权限校验即使拒绝，也须转交会话刷新或清除的 Cookie。
			const cookies = result.headers.getSetCookie();
			if (cookies.length) set.headers["set-cookie"] = cookies;
			return { access: await getAccess(result.response, requirement) };
		},
	}))
	.as("scoped");
