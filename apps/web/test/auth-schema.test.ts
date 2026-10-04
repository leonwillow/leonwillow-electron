/**
 * @file 认证表单校验规则的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、../src/views/login/login-schema、../src/views/register/register-schema。
 * 功能：覆盖空账号、密码边界、确认密码和条款确认。
 * 预期结果：字段规则与错误路径保持预期，密码不被隐式裁剪。
 */
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
			password: "tiny",
			rememberMe: false,
		});
		expect(result.success).toBe(false);
		if (!result.success)
			expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
				"username",
				"password",
			]);
	});

	test("默认管理员可以使用 admin / admin 登录，普通注册仍需八位密码", () => {
		expect(
			loginSchema.safeParse({
				username: "admin",
				password: "admin",
				rememberMe: false,
			}).success,
		).toBe(true);
		expect(
			registerSchema.safeParse({
				username: "new_user",
				password: "admin",
				confirmPassword: "admin",
				agreeToTerms: true,
			}).success,
		).toBe(false);
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
