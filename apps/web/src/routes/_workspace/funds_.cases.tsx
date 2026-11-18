/**
 * @file 案件管理独立文件路由。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：URL 属于 funds 权限范围，视图不嵌套在资金分析页面中，共享 FundsNavigationProvider 案件目录。
 * 被调用：TanStack Router；调用：parseOptionalUuid 与 CasesView。
 * 功能：校验案件参数并渲染独立案件资料管理页。
 * 预期结果：选择案件、导入和资料核对拥有独立地址，消除路由级重复列表请求。
 */
import { createFileRoute } from "@tanstack/react-router";
import { parseOptionalUuid } from "@/lib/uuid";
import CasesView from "@/views/funds/cases-view";

export const Route = createFileRoute("/_workspace/funds_/cases")({
	validateSearch: (search: Record<string, unknown>): { caseId?: string } => ({
		caseId: parseOptionalUuid(search.caseId),
	}),
	component: CasesView,
});
