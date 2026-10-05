/**
 * @file 当前人员的功能访问接口。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-05
 * 版本作用：前端权限快照与路由访问检查。
 * 被调用：app.ts、Web 工作台路由。
 * 调用：accessPlugin、权限规则、Elysia。
 * 功能：输出公开身份和授权，按功能检查访问。
 * 预期结果：不向客户端返回会话 ID 或内部认证字段。
 */
import { Elysia, t } from "elysia";
import { accessPlugin } from "./plugin";
import { requireModule } from "./service";

export const accessModule = new Elysia({
	name: "access",
	prefix: "/api/access",
})
	.use(accessPlugin)
	/** GET：返回身份与功能 ID；未登录 401，服务未配置 503。 */
	.get(
		"/",
		({ access }) => ({ user: access.user, moduleIds: access.moduleIds }),
		{ access: "session" },
	)
	/** GET：检查参数 moduleId；未登记或无权访问返回 403，成功只返回标记。 */
	.get(
		"/modules/:moduleId",
		({ access, params }) => {
			requireModule(access, params.moduleId);
			return { allowed: true } as const;
		},
		{
			access: "session",
			params: t.Object({ moduleId: t.String({ maxLength: 64 }) }),
		},
	);
