// Third-party Imports
import { z } from "zod";

export const loginSchema = z.object({
	username: z.string().trim().min(1, "请输入账号"),
	password: z.string().min(6, "密码至少需要 6 个字符"),
	rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
