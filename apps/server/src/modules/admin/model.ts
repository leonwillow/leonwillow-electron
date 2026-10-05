/**
 * @file 人员管理的请求模型。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：账号创建、资料授权更新和密码重置契约。
 * 被调用：admin 路由和服务，Eden 推导前端类型。
 * 调用：Elysia、共享功能目录。
 * 功能：限制可写字段、角色、账号格式和已登记功能。
 * 预期结果：客户端无法通过额外字段写入认证凭据或任意角色。
 */
import { type ModuleId, modules } from "@leonwillow-electron/access";
import { t } from "elysia";

// TypeBox 的 Union 需要非空元组才能保留静态类型；目录已固定为非空。
const moduleSchema = t.Union(
	modules.map((module) => t.Literal(module.id)) as [
		ReturnType<typeof t.Literal<ModuleId>>,
		...ReturnType<typeof t.Literal<ModuleId>>[],
	],
);
const profile = {
	name: t.String({ minLength: 1, maxLength: 80, pattern: "\\S" }),
	role: t.Union([t.Literal("admin"), t.Literal("user")]),
	moduleIds: t.Array(moduleSchema, {
		uniqueItems: true,
		maxItems: modules.length,
	}),
};
export const AdminModel = {
	create: t.Object(
		{
			...profile,
			username: t.String({
				minLength: 1,
				maxLength: 64,
				pattern: "^[a-zA-Z0-9_.-]+$",
			}),
			password: t.String({ minLength: 8, maxLength: 128 }),
		},
		{ additionalProperties: false },
	),
	update: t.Object(
		{ ...profile, disabled: t.Boolean() },
		{ additionalProperties: false },
	),
	password: t.Object(
		{ password: t.String({ minLength: 8, maxLength: 128 }) },
		{ additionalProperties: false },
	),
	id: t.Object({ userId: t.String({ minLength: 1, maxLength: 128 }) }),
};
export type CreateUserInput = typeof AdminModel.create.static;
export type UpdateUserInput = typeof AdminModel.update.static;
