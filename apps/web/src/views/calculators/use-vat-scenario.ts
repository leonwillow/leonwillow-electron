/**
 * @file 测算方案的串行保存、自动保存与离开保护。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：只确认已提交快照；异步返回不覆盖继续输入的值。
 * 被调用：VatEditor；调用：Eden、TanStack blocker、Sonner。
 * 预期结果：切换方案先保存，冲突停止重试并保留本地内存供导出备份。
 */
import type { VatData } from "@leonwillow-electron/calculators";
import { saveScenario, type VatScenario } from "@/lib/calculators";
import { useScenario } from "./use-scenario";
export type VatDraft = VatData & { name: string };
export function useVatScenario(
	record: VatScenario,
	onSaved: (row: VatScenario) => void,
) {
	return useScenario(
		record,
		{
			name: record.name,
			source: record.source,
			history: record.history,
			adjustments: record.adjustments,
		},
		saveScenario,
		onSaved,
		"vat",
	);
}
