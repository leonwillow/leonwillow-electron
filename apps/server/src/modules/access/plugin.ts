/**
 * @file 受保护 API 共用的 Elysia 权限插件。
 * 创建时间：2026-10-05
 * 修改时间：2026-11-21
 * 版本作用：把 HTTP 会话、来源限制、解析前防线和错误响应接入权限规则。
 * 被调用：access/admin/documents/inquiries/calculators/funds 路由。
 * 调用：Elysia、@leonwillow-electron/auth、server-resources、普通权限服务。
 * 功能：在正文解析前校核来源、会话 Cookie 与非上传请求体积，映射 Better Auth APIError 并透传 Cookie。
 * 预期结果：未登录或非法来源不会消耗正文解析资源，并发会话撤销返回 401 并清 Cookie。
 */
import type { AccessRequirement } from "@leonwillow-electron/access";
import {
	type AuthApiErrorInfo,
	readAuthApiError,
} from "@leonwillow-electron/auth";
import { Elysia, type HTTPHeaders, status } from "elysia";
import {
	getServerResources,
	isTrustedOrigin,
	ServerResourcesUnavailableError,
} from "../../server-resources";
import { AccessError, getAccess } from "./service";

const MAX_JSON_BODY_BYTES = 10 * 1024 * 1024;

function forwardAuthApiError(
	info: AuthApiErrorInfo,
	headers: HTTPHeaders,
): AccessError {
	if (info.setCookies.length) headers["set-cookie"] = info.setCookies;
	if (info.statusCode === 401)
		return new AccessError(401, "UNAUTHENTICATED", "请先登录。");
	if (info.statusCode === 403)
		return new AccessError(403, "FORBIDDEN", "当前账号没有执行该操作的权限。");
	if (info.statusCode === 404)
		return new AccessError(404, info.code, "目标账号或资源不存在。");
	if (info.statusCode === 409)
		return new AccessError(
			409,
			info.code,
			"操作与当前状态冲突，请刷新后重试。",
		);
	if (info.statusCode === 422)
		return new AccessError(422, info.code, "提交参数不符合要求。");
	if (info.statusCode === 429)
		return new AccessError(429, "RATE_LIMITED", "操作过于频繁，请稍后再试。");
	if (info.statusCode >= 400 && info.statusCode < 500)
		return new AccessError(400, info.code, "请求认证校验未通过，请重试。");
	return new AccessError(500, "ACCESS_FAILED", "服务暂时不可用，请稍后重试。");
}

function unwrapError(error: unknown): unknown {
	if (
		error instanceof AccessError ||
		error instanceof ServerResourcesUnavailableError ||
		readAuthApiError(error)
	)
		return error;
	if (error instanceof Error && "cause" in error && error.cause)
		return unwrapError(error.cause);
	return error;
}

/**
 * 直接注册后使用 access: session/admin/功能标识声明权限。
 * 未登录 401、越权/非法来源 403、输入错误 400/422、请求过大 413、未初始化 503、内部故障 500。
 * 每次请求重读会话和授权；错误钩子与来源检查仅传播到直接使用该插件的模块。
 */
export const accessPlugin = new Elysia({ name: "Access.Plugin" })
	.onRequest(({ set }) => {
		set.headers["cache-control"] = "no-store";
		set.headers["x-request-id"] = crypto.randomUUID();
	})
	.onParse(({ request }) => {
		getServerResources();
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
		if (!request.headers.get("cookie")?.trim()) {
			throw new AccessError(401, "UNAUTHENTICATED", "请先登录。");
		}
		const contentType = (
			request.headers.get("content-type") ?? ""
		).toLowerCase();
		const contentLength = Number(request.headers.get("content-length") ?? "0");
		if (
			!contentType.includes("multipart/form-data") &&
			Number.isFinite(contentLength) &&
			contentLength > MAX_JSON_BODY_BYTES
		) {
			throw new AccessError(
				413,
				"PAYLOAD_TOO_LARGE",
				"请求内容超过 10 MB 限制，请减少提交数据后重试。",
			);
		}
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
		const root = unwrapError(error);
		if (root instanceof ServerResourcesUnavailableError)
			return status(503, {
				code: "ACCESS_UNAVAILABLE",
				message: "人员与权限服务尚未配置。",
			});
		const authApiError = readAuthApiError(root);
		if (authApiError) {
			const mapped = forwardAuthApiError(authApiError, set.headers);
			return status(mapped.statusCode, {
				code: mapped.code,
				message: mapped.message,
			});
		}
		if (root instanceof AccessError)
			return status(root.statusCode, {
				code: root.code,
				message: root.message,
			});
		if (code === "VALIDATION")
			return status(422, {
				code: "VALIDATION_ERROR",
				message: "提交的内容不符合要求，请检查输入参数后重试。",
			});
		if (code === "PARSE")
			return status(400, {
				code: "INVALID_JSON",
				message: "请求 JSON 格式无效。",
			});
		console.error("受保护接口请求失败：", {
			requestId: set.headers["x-request-id"],
			code,
			name: error instanceof Error ? error.name : typeof error,
		});
		return status(500, {
			code: "ACCESS_FAILED",
			message: "服务暂时不可用，请稍后重试。",
		});
	})
	.macro("access", (requirement: AccessRequirement) => ({
		async resolve({ request, set }) {
			const { auth } = getServerResources();
			const result = await auth.api
				.getSession({
					headers: request.headers,
					query: { disableCookieCache: true },
					returnHeaders: true,
				})
				.catch((error: unknown) => {
					const authApiError = readAuthApiError(error);
					if (authApiError)
						throw forwardAuthApiError(authApiError, set.headers);
					throw error;
				});
			// 后续权限校验即使拒绝，也须转交会话刷新或清除的 Cookie。
			const cookies = result.headers.getSetCookie();
			if (cookies.length) set.headers["set-cookie"] = cookies;
			return { access: await getAccess(result.response, requirement) };
		},
	}))
	.as("scoped");
