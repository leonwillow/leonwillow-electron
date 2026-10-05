/**
 * @file 认证库响应到公开 API 的转换。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-05
 * 版本作用：现有 /api/auth 契约的服务端实现。
 * 被调用：apps/server/test/auth-response.test.ts、apps/server/src/modules/auth/index.ts。
 * 调用：@leonwillow-electron/auth、elysia、./http、./model。
 * 功能：转交 Cookie 与限流头，映射中文错误，只返回公开用户字段。
 * 预期结果：内部邮箱、密码和会话 token 不进入用户资料响应。
 */
import type { Auth } from "@leonwillow-electron/auth";
import { type HTTPHeaders, status } from "elysia";
import type { AuthEndpoint } from "./http";
import type { AuthError, LogoutResponse, UserResponse } from "./model";

type AuthPayload = {
	user?: Auth["$Infer"]["Session"]["user"];
	code?: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
	USERNAME_IS_ALREADY_TAKEN: "该账号已被使用，请换一个账号。",
	INVALID_USERNAME_OR_PASSWORD: "账号或密码不正确。",
	INVALID_USERNAME: "账号格式无效，请检查是否包含空格或无效字符。",
	USERNAME_TOO_SHORT: "请输入账号。",
	USERNAME_TOO_LONG: "账号不能超过 64 个字符。",
	PASSWORD_TOO_SHORT: "密码至少需要 8 个字符。",
	PASSWORD_TOO_LONG: "密码不能超过 128 个字符。",
	INVALID_ORIGIN: "当前页面来源未获允许，请检查服务端配置。",
	MISSING_OR_NULL_ORIGIN: "无法验证当前页面来源。",
	BANNED_USER: "账号已停用，请联系管理员。",
};

function errorResponse(statusCode: number, error: AuthError) {
	switch (statusCode) {
		case 400:
			return status(400, error);
		case 401:
			return status(401, error);
		case 403:
			return status(403, error);
		case 422:
			return status(422, error);
		case 429:
			return status(429, error);
		case 503:
			return status(503, error);
		default:
			return status(500, error);
	}
}

/**
 * 转交 Cookie、限流头并禁用缓存，将内部错误映射为公开账号错误。
 * @param result Better Auth handler 的响应 Promise。
 * @param path 内部端点，用于将注册时的邮箱错误翻译为账号错误。
 * @param outputHeaders Elysia 响应头；此函数会写入，多条 Set-Cookie 保持为数组。
 * @returns 成功时返回 payload；失败时返回受契约约束的 HTTP 错误。
 */
async function readAuthResponse(
	result: Promise<Response>,
	path: AuthEndpoint,
	outputHeaders: HTTPHeaders,
) {
	const response = await result;
	const payload = (await response.json()) as AuthPayload | null;
	for (const [name, value] of response.headers) {
		if (name !== "content-length" && name !== "set-cookie")
			outputHeaders[name] = value;
	}
	// 保留多条 Cookie，不将它们拼成一条响应头。
	const cookies = response.headers.getSetCookie();
	if (cookies.length) outputHeaders["set-cookie"] = cookies;
	outputHeaders["cache-control"] = "no-store";
	if (response.ok) return { payload };
	let code = payload?.code ?? "AUTH_FAILED";
	// 内部邮箱的格式与唯一性错误以账号错误返回。
	if (path === "/sign-up/email") {
		if (code === "INVALID_EMAIL" || code === "VALIDATION_ERROR")
			code = "INVALID_USERNAME";
		if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
			code = "USERNAME_IS_ALREADY_TAKEN";
	}
	return errorResponse(response.status, {
		code,
		message:
			response.status === 429
				? "操作过于频繁，请稍后再试。"
				: (AUTH_ERROR_MESSAGES[code] ?? "认证操作失败，请稍后再试。"),
	});
}

/**
 * 从认证响应挑选公开用户资料，避免把内部邮箱和会话 token 放入 JSON。
 * @param result handler 响应，成功体应含 user。
 * @param path 注册、登录或会话端点。
 * @param headers 接收 Cookie 和缓存策略的 Elysia 响应头。
 * @returns 公开 user，或认证错误；没有有效账号时返回 401。
 */
export async function userAuthResponse(
	result: Promise<Response>,
	path: Exclude<AuthEndpoint, "/sign-out">,
	headers: HTTPHeaders,
) {
	const response = await readAuthResponse(result, path, headers);
	if (!("payload" in response)) return response;
	const user = response.payload?.user;
	if (
		!user?.username ||
		(user.banned &&
			(!user.banExpires || new Date(user.banExpires) > new Date()))
	) {
		const error: AuthError = {
			code: "UNAUTHENTICATED",
			message: "请先登录。",
		};
		return status(401, error);
	}
	// 浏览器只接收公开资料，会话 token 仅通过 HttpOnly Cookie 传递。
	return {
		user: {
			id: user.id,
			username: user.displayUsername ?? user.username,
			name: user.name,
			image: user.image ?? null,
			role: user.role === "admin" ? "admin" : "user",
		},
	} satisfies UserResponse;
}

/**
 * 转交退出响应中的 Cookie 清除指令。
 * @param result sign-out 的 handler 响应。
 * @param headers 将被写入的 Elysia 响应头。
 * @returns 成功标记；上游错误沿用账号接口的错误契约。
 */
export async function logoutAuthResponse(
	result: Promise<Response>,
	headers: HTTPHeaders,
) {
	const response = await readAuthResponse(result, "/sign-out", headers);
	if (!("payload" in response)) return response;
	return { success: true } satisfies LogoutResponse;
}
