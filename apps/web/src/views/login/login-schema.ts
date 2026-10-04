/**
 * @file 登录表单的输入规则。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/test/auth-schema.test.ts、views/login/login-form.tsx。
 * 调用：zod。
 * 功能：使用 Zod 校验字段并推导表单类型。
 * 预期结果：账号去除首尾空格，密码保留原样；错误反馈为中文。
 */
import { z } from "zod";

export const loginSchema = z.object({
	username: z
		.string()
		.trim()
		.min(1, "请输入账号")
		.max(64, "账号不能超过 64 个字符"),
	password: z
		.string()
		.min(5, "密码至少需要 5 个字符")
		.max(128, "密码不能超过 128 个字符"),
	rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
