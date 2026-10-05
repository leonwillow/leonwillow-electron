/**
 * @file 认证表单校验规则的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、../src/views/login/login-schema、../src/views/admin/users/person-schema。
 * 功能：覆盖空账号、密码边界、管理表单与功能选项。
 * 预期结果：字段规则与错误路径保持预期，密码不被隐式裁剪。
 */
import { describe, expect, test } from "bun:test";
import { personFormSchema } from "../src/views/admin/users/person-schema";
import { loginSchema } from "../src/views/login/login-schema";

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

	test("兼容已有五位密码账号，新建人员仍需八位密码", () => {
		expect(
			loginSchema.safeParse({
				username: "admin",
				password: "admin",
				rememberMe: false,
			}).success,
		).toBe(true);
		expect(
			personFormSchema(false).safeParse({
				username: "new_user",
				password: "admin",
				name: "人员",
				role: "user",
				disabled: false,
				moduleIds: [],
			}).success,
		).toBe(false);
	});

	test("管理表单拒绝空白姓名、非法账号和未登记授权，并保留密码原样", () => {
		const values = {
			username: "invalid account",
			name: " ",
			password: " pass word 8 ",
			role: "user",
			disabled: false,
			moduleIds: ["unregistered"],
		};
		const result = personFormSchema(false).safeParse(values);
		expect(result.success).toBe(false);
		if (!result.success)
			expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
				"name",
				"username",
				"moduleIds",
			]);
		expect(
			personFormSchema(false).parse({
				...values,
				username: "leon_01",
				name: " 人员 ",
				moduleIds: ["inbox"],
			}).password,
		).toBe(values.password);
	});
});
