/**
 * @file 当前案件的资金分析文件路由。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：组织 CSR 案件参数、加载和失败恢复，资料管理使用独立路由。
 * 被调用：TanStack Router；调用：Eden 案件列表及 funds 视图。
 * 预期结果：父级权限校验通过后显示完整案件，URL 保留案件选择。
 */
import { createFileRoute } from "@tanstack/react-router";
import { listFundsCases } from "@/lib/funds";
import FundsView from "@/views/funds";
import { FundsErrorView, FundsPendingView } from "@/views/funds/route-states";
export const Route = createFileRoute("/_workspace/funds")({
	validateSearch: (search: Record<string, unknown>): { caseId?: string } => ({
		caseId: typeof search.caseId === "string" ? search.caseId : undefined,
	}),
	loader: listFundsCases,
	staleTime: 0,
	preloadStaleTime: 0,
	component: FundsView,
	errorComponent: FundsErrorView,
	pendingComponent: FundsPendingView,
});
