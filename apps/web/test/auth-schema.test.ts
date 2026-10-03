import { describe, expect, test } from "bun:test";
import { loginSchema } from "../src/views/login/login-schema";
import { registerSchema } from "../src/views/register/register-schema";

describe("账号密码表单", () => {
	test("登录接受普通账号，去掉账号首尾空格但保留密码", () => {
		expect(
			loginSchema.parse({
				username: "  leon_01  ",
				password: " pass word ",
				rememberMe: true,
			}),
		).toEqual({
			username: "leon_01",
			password: " pass word ",
			rememberMe: true,
		});
	});

	test("空白账号和过短登录密码不能提交", () => {
		const result = loginSchema.safeParse({
			username: "   ",
			password: "short",
			rememberMe: false,
		});
		expect(result.success).toBe(false);
		if (!result.success)
			expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
				"username",
				"password",
			]);
	});

	test("注册使用账号，要求确认密码与条款", () => {
		const values = {
			username: "leon_01",
			password: "password8",
			confirmPassword: "different",
			agreeToTerms: false,
		};
		const result = registerSchema.safeParse(values);
		expect(result.success).toBe(false);
		if (!result.success)
			expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
				"confirmPassword",
				"agreeToTerms",
			]);
		expect(
			registerSchema.safeParse({
				...values,
				confirmPassword: values.password,
				agreeToTerms: true,
			}).success,
		).toBe(true);
	});
});
