/**
 * @file 计算器工作区的 CSR 路由与测算方案选择。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：父工作区执行 calculators 授权，页面只接收合法方案 ID。
 * 被调用：TanStack Router；调用：LateFeesView。
 * 预期结果：方案可刷新直达，界面与计算逻辑留在 views 和共享领域包。
 */
import { createFileRoute } from "@tanstack/react-router";
import LateFeesView from "@/views/calculators/late-fees";
export const Route = createFileRoute("/_workspace/calculators_/late-fees")({
	validateSearch: (
		search: Record<string, unknown>,
	): { scenarioId?: string } => ({
		scenarioId:
			typeof search.scenarioId === "string" &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
				search.scenarioId,
			)
				? search.scenarioId
				: undefined,
	}),
	component: LateFeesView,
});
