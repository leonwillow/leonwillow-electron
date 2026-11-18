/**
 * @file 计算器工作区的 CSR 路由与测算方案选择。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：父工作区执行 calculators 授权，页面只接收合法方案 ID。
 * 被调用：TanStack Router；调用：LateFeesView。
 * 预期结果：方案可刷新直达，界面与计算逻辑留在 views 和共享领域包。
 */
import { createFileRoute } from "@tanstack/react-router";
import { parseOptionalUuid } from "@/lib/uuid";
import LateFeesView from "@/views/calculators/late-fees";
export const Route = createFileRoute("/_workspace/calculators_/late-fees")({
	validateSearch: (
		search: Record<string, unknown>,
	): { scenarioId?: string } => ({
		scenarioId: parseOptionalUuid(search.scenarioId),
	}),
	component: LateFeesView,
});
