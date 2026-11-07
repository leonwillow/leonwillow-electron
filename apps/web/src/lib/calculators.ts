/**
 * @file 增值税方案 Eden 客户端与下载边界。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 版本作用：从服务端推导方案类型，浏览器不保存业务数据到 localStorage。
 * 被调用：计算器视图；调用：共享 api 与领域类型。
 * 预期结果：修订冲突保持当前输入，可导出备份；错误保留 HTTP 状态。
 */
import type { VatData } from "@leonwillow-electron/calculators";
import { api } from "./api";

const vat = api.api.calculators.vat;
export class CalculatorError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}
export function unwrap<T>(r: {
	data: T | null;
	error: { value: unknown; status: number } | null;
}): T {
	if (r.error) {
		const v = r.error.value;
		throw new CalculatorError(
			typeof v === "object" &&
				v &&
				"message" in v &&
				typeof v.message === "string"
				? v.message
				: "计算器操作失败，请稍后重试。",
			r.error.status,
		);
	}
	if (!r.data) throw Error("计算器未返回有效结果");
	return r.data;
}
export const calculatorError = (e: unknown) =>
	e instanceof Error ? e.message : "无法连接计算器服务";
export const listScenarios = async () => unwrap(await vat.get()).scenarios;
export const getScenario = async (id: string) =>
	unwrap(await vat({ id }).get());
export const createScenario = async (name: string, requestId: string) =>
	unwrap(await vat.post({ name, requestId }));
export const saveScenario = async (
	id: string,
	revision: number,
	data: VatData & { name: string },
) => unwrap(await vat({ id }).put({ ...data, revision, replaceHistory: true }));
export type VatScenario = Awaited<ReturnType<typeof getScenario>>;
export type ScenarioSummary = Awaited<ReturnType<typeof listScenarios>>[number];
export function downloadCalculation(name: string, text: string, type: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name.replace(/[\\/:*?"<>|]/g, "_");
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const updateScenario = async (
	id: string,
	revision: number,
	patch: { name?: string; archived?: boolean },
) => unwrap(await vat({ id }).patch({ ...patch, revision }));
