/**
 * @file 管理员专用人员与授权 API。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-05
 * 版本作用：只暴露工作台需要的账号管理能力。
 * 被调用：app.ts、Web 人员管理页面。
 * 调用：accessPlugin、AdminModel、管理事务服务。
 * 功能：人员列表、创建、编辑授权、密码重置和最近操作记录。
 * 预期结果：所有路由要求管理员；公开响应不含密码、内部邮箱或 token。
 */
import { Elysia } from "elysia";
import { accessPlugin } from "../access/plugin";
import { AdminModel } from "./model";
import {
	createUser,
	listAudit,
	listUsers,
	resetPassword,
	updateUser,
} from "./service";

export const adminModule = new Elysia({ name: "admin", prefix: "/api/admin" })
	.use(accessPlugin)
	.model(AdminModel)
	.prefix("model", "admin.")
	.guard({ access: "admin" })
	/** GET：管理员读取人员资料和授权；未登录 401、普通人员 403。 */
	.get("/users", async () => ({ users: await listUsers() }))
	/** POST：创建账号及授权；格式错误 422、重名 409，不自动登录新账号。 */
	.post(
		"/users",
		async ({ access, body }) => ({
			user: await createUser(access, body),
		}),
		{ body: "admin.Create" },
	)
	/** PATCH：整份替换姓名、身份、停用状态和授权；自我锁定/最后管理员保护返回 409。 */
	.patch(
		"/users/:userId",
		async ({ access, request, params, body }) => ({
			user: await updateUser(access, request.headers, params.userId, body),
		}),
		{ params: "admin.Id", body: "admin.Update" },
	)
	/** POST：重置目标密码并撤销全部会话；密码长度错误 422、目标不存在 404。 */
	.post(
		"/users/:userId/password",
		({ access, request, params, body }) =>
			resetPassword(access, request.headers, params.userId, body.password),
		{ params: "admin.Id", body: "admin.Password" },
	)
	/** GET：最近 100 条管理记录，包含修改前后状态，不提供清除入口。 */
	.get("/audit", async () => ({ events: await listAudit() }));
