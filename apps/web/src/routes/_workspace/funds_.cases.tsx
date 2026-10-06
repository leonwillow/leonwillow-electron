/**
 * @file 案件管理独立文件路由。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：URL 属于 funds 权限范围，视图不嵌套在资金分析页面中。
 * 被调用：TanStack Router；调用：Eden 案件列表与 CasesView。
 * 功能：校验案件参数，加载可访问案件并提供失败恢复。
 * 预期结果：选择案件、导入和资料核对拥有独立地址。
 */
import { createFileRoute } from "@tanstack/react-router";
import { listFundsCases } from "@/lib/funds";
import CasesView from "@/views/funds/cases-view";
import { FundsErrorView, FundsPendingView } from "@/views/funds/route-states";

export const Route = createFileRoute("/_workspace/funds_/cases")({
	validateSearch: (search: Record<string, unknown>): { caseId?: string } => ({
		caseId: typeof search.caseId === "string" ? search.caseId : undefined,
	}),
	loader: listFundsCases,
	staleTime: 0,
	preloadStaleTime: 0,
	component: CasesView,
	errorComponent: FundsErrorView,
	pendingComponent: FundsPendingView,
});
