/**
 * @file 按所有者隔离的滞纳金方案事务服务。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：税款与分次缴款独立保存，服务端重算并持久化带规则版本的结果。
 * 被调用：计算器 API；调用：Drizzle、资源工厂、共享计算规则。
 * 预期结果：旧修订返回409、他人资源404、坏结构422；失败事务不改变已有快照。
 */
import {
	calculateLateFees,
	LATE_FEE_RULES,
} from "@leonwillow-electron/calculators/late-fees";
import { lateFeeScenario } from "@leonwillow-electron/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import type { LateFeeSave } from "./model";

const db = () => getServerResources().db;
const owned = (access: AccessSession, id?: string) =>
	and(
		eq(lateFeeScenario.ownerId, access.user.id),
		isNull(lateFeeScenario.deletedAt),
		id ? eq(lateFeeScenario.id, id) : undefined,
	);
const missing = (): never => {
	throw new AccessError(
		404,
		"LATE_FEE_NOT_FOUND",
		"测算方案不存在，或你无权访问。",
	);
};
export async function list(access: AccessSession) {
	return db()
		.select({
			id: lateFeeScenario.id,
			name: lateFeeScenario.name,
			archived: lateFeeScenario.archived,
			revision: lateFeeScenario.revision,
			updatedAt: lateFeeScenario.updatedAt,
		})
		.from(lateFeeScenario)
		.where(owned(access))
		.orderBy(desc(lateFeeScenario.updatedAt));
}
export async function get(access: AccessSession, id: string) {
	const [row] = await db()
		.select()
		.from(lateFeeScenario)
		.where(owned(access, id));
	return row ?? missing();
}
/** requestId 为幂等创建键；同一人员重试不产生重复方案，也不覆盖现有方案。 */
export async function create(
	access: AccessSession,
	name: string,
	requestId: string,
) {
	await db()
		.insert(lateFeeScenario)
		.values({
			id: requestId,
			ownerId: access.user.id,
			name: name.trim(),
			cutoff: "",
			liabilities: [],
			result: calculateLateFees({ cutoff: "", liabilities: [] }),
			rulesVersion: LATE_FEE_RULES,
		})
		.onConflictDoNothing();
	return get(access, requestId);
}
/** 父行锁与修订号共同保护完整快照；从不信任浏览器计算结果。 */
export async function save(
	access: AccessSession,
	id: string,
	input: LateFeeSave,
) {
	return db().transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(lateFeeScenario)
			.where(owned(access, id))
			.for("update");
		if (!row) return missing();
		if (row.archived)
			throw new AccessError(
				409,
				"SCENARIO_ARCHIVED",
				"方案已归档，请先在目录中恢复后编辑。",
			);
		if (row.revision !== input.revision)
			throw new AccessError(
				409,
				"LATE_FEE_CONFLICT",
				"方案已在其他窗口更新。请先导出当前方案备份，再重新打开。",
			);
		const result = calculateLateFees(input);
		const [updated] = await tx
			.update(lateFeeScenario)
			.set({
				name: input.name.trim(),
				cutoff: input.cutoff,
				liabilities: input.liabilities,
				result,
				rulesVersion: LATE_FEE_RULES,
				revision: row.revision + 1,
				updatedAt: new Date(),
			})
			.where(eq(lateFeeScenario.id, id))
			.returning();
		if (!updated) return missing();
		return updated;
	});
}
