/**
 * @file 滞纳金方案的 Eden 客户端适配。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：类型从 API 推导，录入与修订一起提交。
 * 被调用：滞纳金工作区；调用：共享 api 和错误边界；预期结果：保存真实数据库并传播冲突状态。
 */
import type { LateFeeDraft } from "@leonwillow-electron/calculators/late-fees";
import { api } from "./api";
import { unwrap } from "./calculators";

const lateFees = api.api.calculators["late-fees"];
export const listLateFees = async () => unwrap(await lateFees.get()).scenarios;
export const getLateFee = async (id: string) =>
	unwrap(await lateFees({ id }).get());
export const createLateFee = async (name: string, requestId: string) =>
	unwrap(await lateFees.post({ name, requestId }));
export const saveLateFee = async (
	id: string,
	revision: number,
	data: LateFeeDraft,
) => unwrap(await lateFees({ id }).put({ ...data, revision }));
export type LateFeeScenario = Awaited<ReturnType<typeof getLateFee>>;

export const updateLateFee = async (
	id: string,
	revision: number,
	patch: { name?: string; archived?: boolean },
) => unwrap(await lateFees({ id }).patch({ ...patch, revision }));
