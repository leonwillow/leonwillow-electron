// Third-party Imports
import { z } from "zod";

export const registerSchema = z
	.object({
		username: z.string().trim().min(1, "请输入账号"),
		password: z.string().min(8, "密码至少需要 8 个字符"),
		confirmPassword: z.string().min(1, "请再次输入密码"),
		agreeToTerms: z.boolean(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	})
	.refine((data) => data.agreeToTerms, {
		message: "请先同意隐私政策与服务条款",
		path: ["agreeToTerms"],
	});

export type RegisterFormValues = z.infer<typeof registerSchema>;
