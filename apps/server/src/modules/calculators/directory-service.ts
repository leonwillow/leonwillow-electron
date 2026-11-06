/**
 * @file 两种计算器共用的方案元数据与软删除事务。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：目录改名、归档、恢复和删除不提交或覆盖计算资料。
 * 被调用：计算器 API；调用：Drizzle、资源工厂与授权错误边界。
 * 预期结果：所有者隔离、行锁和修订保护；历史与计算快照保持原样。
 */
import { lateFeeScenario, vatScenario } from "@leonwillow-electron/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import type { ScenarioMetadata } from "./model";

type Kind = "vat" | "late-fees";
/** 只写指定元数据；空修改400、所有者不符/已删除404、旧修订409，失败不改变数据。 */
async function mutate(
	access: AccessSession,
	kind: Kind,
	id: string,
	input: ScenarioMetadata,
	deleting = false,
) {
	if (!deleting && input.name === undefined && input.archived === undefined)
		throw new AccessError(
			400,
			"EMPTY_SCENARIO_PATCH",
			"请指定需要修改的名称或归档状态。",
		);
	const table = kind === "vat" ? vatScenario : lateFeeScenario;
	const summary = {
		id: table.id,
		name: table.name,
		archived: table.archived,
		revision: table.revision,
		updatedAt: table.updatedAt,
	};
	return getServerResources().db.transaction(async (tx) => {
		const [row] = await tx
			.select(summary)
			.from(table)
			.where(
				and(
					eq(table.id, id),
					eq(table.ownerId, access.user.id),
					isNull(table.deletedAt),
				),
			)
			.for("update");
		if (!row)
			throw new AccessError(
				404,
				"SCENARIO_NOT_FOUND",
				"测算方案不存在，或你无权访问。",
			);
		if (row.revision !== input.revision)
			throw new AccessError(
				409,
				"SCENARIO_CONFLICT",
				"方案已发生变化，请刷新目录后重试。",
			);
		const now = new Date();
		const [updated] = await tx
			.update(table)
			.set({
				...(input.name !== undefined ? { name: input.name.trim() } : {}),
				...(input.archived !== undefined ? { archived: input.archived } : {}),
				...(deleting ? { deletedAt: now, deletedBy: access.user.id } : {}),
				revision: row.revision + 1,
				updatedAt: now,
			})
			.where(eq(table.id, id))
			.returning(summary);
		if (!updated)
			throw new AccessError(404, "SCENARIO_NOT_FOUND", "测算方案不存在。");
		return updated;
	});
}
export const update = (
	access: AccessSession,
	kind: Kind,
	id: string,
	input: ScenarioMetadata,
) => mutate(access, kind, id, input);
/** 软删除保留资料及审计信息；正常读取、保存和幂等创建重试均不能恢复已删除方案。 */
export const remove = (
	access: AccessSession,
	kind: Kind,
	id: string,
	revision: number,
) => mutate(access, kind, id, { revision }, true);
