/**
 * @file 按所有者隔离的增值税方案事务服务。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：原始申报追加或校正、调整独立保存，服务端重算并持久化带规则版本的结果。
 * 被调用：计算器 API；调用：Drizzle、资源工厂、共享计算规则。
 * 预期结果：旧修订返回409、他人资源404、坏历史400；失败事务不改变任何历史。
 */
import {
	calculate,
	type HistoryRow,
	mergeHistory,
	normalizeAdjustments,
	normalizeHistory,
	RULES_VERSION,
} from "@leonwillow-electron/calculators";
import { vatScenario } from "@leonwillow-electron/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getServerResources } from "../../server-resources";
import { AccessError, type AccessSession } from "../access/service";
import type { VatSave } from "./model";

const db = () => getServerResources().db;
const owned = (access: AccessSession, id?: string) =>
	and(
		eq(vatScenario.ownerId, access.user.id),
		isNull(vatScenario.deletedAt),
		id ? eq(vatScenario.id, id) : undefined,
	);
const missing = (): never => {
	throw new AccessError(404, "VAT_NOT_FOUND", "测算方案不存在，或你无权访问。");
};
export async function list(access: AccessSession) {
	return db()
		.select({
			id: vatScenario.id,
			name: vatScenario.name,
			archived: vatScenario.archived,
			revision: vatScenario.revision,
			updatedAt: vatScenario.updatedAt,
		})
		.from(vatScenario)
		.where(owned(access))
		.orderBy(desc(vatScenario.updatedAt));
}
export async function get(access: AccessSession, id: string) {
	const [row] = await db().select().from(vatScenario).where(owned(access, id));
	if (!row) return missing();
	// 读取旧 JSON 仅在内存转换并重算，不更新版本、修订或时间；保存才写入 v3。
	const history = normalizeHistory(row.history);
	const adjustments = normalizeAdjustments(row.adjustments, history);
	return {
		...row,
		history,
		adjustments,
		result: calculate(history, adjustments),
		rulesVersion: RULES_VERSION,
	};
}
/** requestId 为幂等创建键；同一人员重试不产生重复方案，也不覆盖现有方案。 */
export async function create(
	access: AccessSession,
	name: string,
	requestId: string,
) {
	await db()
		.insert(vatScenario)
		.values({
			id: requestId,
			ownerId: access.user.id,
			name: name.trim(),
			history: [],
			adjustments: {},
			result: calculate([], {}),
			rulesVersion: RULES_VERSION,
		})
		.onConflictDoNothing();
	return get(access, requestId);
}
/** 父行锁与修订号共同保护完整快照；从不信任浏览器计算结果。 */
export async function save(access: AccessSession, id: string, input: VatSave) {
	return db().transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(vatScenario)
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
				"VAT_CONFLICT",
				"方案已在其他窗口更新。请先导出当前方案备份，再重新打开。",
			);
		let history: HistoryRow[];
		let adjustments: typeof row.adjustments;
		let result: typeof row.result;
		try {
			history = mergeHistory(row.history, input.history, true).rows;
			adjustments = normalizeAdjustments(input.adjustments, history);
			result = calculate(history, adjustments);
		} catch (error) {
			throw new AccessError(
				400,
				"VAT_INVALID",
				error instanceof Error ? error.message : "测算数据无效",
			);
		}
		const [updated] = await tx
			.update(vatScenario)
			.set({
				name: input.name.trim(),
				source: input.source,
				history,
				adjustments,
				result,
				rulesVersion: RULES_VERSION,
				revision: row.revision + 1,
				updatedAt: new Date(),
			})
			.where(eq(vatScenario.id, id))
			.returning();
		if (!updated) return missing();
		return { ...updated, history };
	});
}
