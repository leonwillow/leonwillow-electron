/**
 * @file 认证响应公开边界的回归测试。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-05
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、@elysiajs/eden、elysia、认证 HTTP 适配器、模型与响应处理。
 * 功能：模拟库响应，检查多条 Cookie、限流头和内部邮箱错误映射。
 * 预期结果：公开接口保留会话语义且不泄漏内部错误细节。
 */
import { expect, spyOn, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { Elysia } from "elysia";
import { createApp } from "../src/app";
import * as authHttp from "../src/modules/auth/http";
import { AuthModel } from "../src/modules/auth/model";
import { userAuthResponse } from "../src/modules/auth/response";

test("内部异常与响应模型错误返回 500，诊断不泄露异常中的凭据", async () => {
	const logger = spyOn(console, "error").mockImplementation(() => {});
	try {
		for (const handler of [
			async () => {
				throw new Error("password=private-test-secret");
			},
			async () =>
				Response.json({
					user: { id: 123, username: "test_user", name: "Test", role: "user" },
				}),
		]) {
			const request = spyOn(authHttp, "requestBetterAuth").mockImplementation(
				handler,
			);
			try {
				const response = await createApp().handle(
					new Request("http://localhost/api/auth/session"),
				);
				expect(response.status).toBe(500);
				expect(await response.json()).toMatchObject({ code: "AUTH_FAILED" });
				expect(response.headers.get("x-request-id")).toBeTruthy();
			} finally {
				request.mockRestore();
			}
		}
		expect(logger).toHaveBeenCalledTimes(2);
		expect(JSON.stringify(logger.mock.calls)).not.toContain(
			"private-test-secret",
		);
	} finally {
		logger.mockRestore();
	}
});

test("适配认证错误时保留多条 Cookie 与限流响应头，不泄漏内部邮箱错误", async () => {
	const headers = new Headers({ "retry-after": "10" });
	headers.append("set-cookie", "session_token=; Path=/; Max-Age=0; HttpOnly");
	headers.append("set-cookie", "dont_remember=; Path=/; Max-Age=0; HttpOnly");
	const app = new Elysia()
		.model(AuthModel)
		.prefix("model", "auth.")
		.get(
			"/register-error",
			({ set }) =>
				userAuthResponse(
					Promise.resolve(
						Response.json(
							{
								code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
								message: "Internal email is already registered.",
							},
							{ status: 400, headers },
						),
					),
					"/sign-up/email",
					set.headers,
				),
			{ response: { 400: "auth.Error" } },
		);
	const result = await treaty(app)["register-error"].get();
	expect(result.status).toBe(400);
	expect(result.error?.value).toEqual({
		code: "USERNAME_IS_ALREADY_TAKEN",
		message: "该账号已被使用，请换一个账号。",
	});
	expect(result.response.headers.getSetCookie()).toEqual(
		headers.getSetCookie(),
	);
	expect(result.response.headers.get("retry-after")).toBe("10");
	expect(result.response.headers.get("cache-control")).toBe("no-store");
});
