/**
 * @file 计算器模块的授权 HTTP 与 Eden 契约。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：为 Web 和未来桌面端提供方案列表、创建、读取与保存。
 * 被调用：createApp；调用：权限插件、有界模型、计算器事务服务。
 * 预期结果：无会话401、无模块权限403，全部读写限制当前所有者。
 */
import { Elysia } from "elysia";
import { accessPlugin } from "../access/plugin";
import * as directory from "./directory-service";
import * as lateFees from "./late-fee-service";
import { lateFeeSave, CalculatorsModel as M } from "./model";
import * as service from "./service";
export const calculatorsModule = new Elysia({
	name: "calculators",
	prefix: "/api/calculators",
})
	.use(accessPlugin)
	.guard({ access: "calculators" })
	.get("/vat", async ({ access }) => ({
		scenarios: await service.list(access),
	}))
	.post(
		"/vat",
		({ access, body }) => service.create(access, body.name, body.requestId),
		{ body: M.create },
	)
	.get("/vat/:id", ({ access, params }) => service.get(access, params.id), {
		params: M.id,
	})
	.patch(
		"/vat/:id",
		({ access, params, body }) =>
			directory.update(access, "vat", params.id, body),
		{ params: M.id, body: M.metadata },
	)
	.delete(
		"/vat/:id",
		({ access, params, body }) =>
			directory.remove(access, "vat", params.id, body.revision),
		{ params: M.id, body: M.remove },
	)
	.put(
		"/vat/:id",
		({ access, params, body }) => service.save(access, params.id, body),
		{ params: M.id, body: M.save },
	)
	.get("/late-fees", async ({ access }) => ({
		scenarios: await lateFees.list(access),
	}))
	.post(
		"/late-fees",
		({ access, body }) => lateFees.create(access, body.name, body.requestId),
		{ body: M.create },
	)
	.get(
		"/late-fees/:id",
		({ access, params }) => lateFees.get(access, params.id),
		{ params: M.id },
	)
	.patch(
		"/late-fees/:id",
		({ access, params, body }) =>
			directory.update(access, "late-fees", params.id, body),
		{ params: M.id, body: M.metadata },
	)
	.delete(
		"/late-fees/:id",
		({ access, params, body }) =>
			directory.remove(access, "late-fees", params.id, body.revision),
		{ params: M.id, body: M.remove },
	)
	.put(
		"/late-fees/:id",
		({ access, params, body }) => lateFees.save(access, params.id, body),
		{ params: M.id, body: lateFeeSave },
	);
