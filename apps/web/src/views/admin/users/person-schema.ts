/**
 * @file 人员管理表单的输入校验。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：管理表单共用规则，密码保持原始输入。
 * 被调用：人员编辑弹窗和表单测试。
 * 调用：Zod、功能目录。
 * 功能：校验姓名、账号、角色、密码与授权选项。
 * 预期结果：创建要求密码，编辑资料不隐式修改密码。
 */
import { modules } from "@leonwillow-electron/access";
import { z } from "zod";

export const managedPasswordSchema = z
	.string()
	.min(8, "密码至少需要 8 个字符。")
	.max(128, "密码不能超过 128 个字符。");

export const personFormSchema = (editing: boolean) =>
	z.object({
		name: z
			.string()
			.trim()
			.min(1, "请输入姓名。")
			.max(80, "姓名不能超过 80 个字符。"),
		username: z
			.string()
			.trim()
			.min(1, "请输入账号。")
			.max(64, "账号不能超过 64 个字符。")
			.refine(
				(value) => editing || /^[a-zA-Z0-9_.-]+$/.test(value),
				"账号只能使用英文字母、数字、点、下划线或短横线。",
			),
		password: editing ? z.string() : managedPasswordSchema,
		role: z.enum(["user", "admin"]),
		disabled: z.boolean(),
		moduleIds: z.array(z.enum(modules.map((module) => module.id))),
	});
export type PersonFormValues = z.infer<ReturnType<typeof personFormSchema>>;
