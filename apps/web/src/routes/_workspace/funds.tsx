/**
 * @file 当前案件的资金分析文件路由。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：组织 CSR 案件参数校验与视图挂载，目录状态统一由 FundsNavigationProvider 共享。
 * 被调用：TanStack Router；调用：parseOptionalUuid 及 funds 视图。
 * 预期结果：父级权限校验通过后显示完整案件，不产生与二级菜单重复的案件列表请求。
 */
import { createFileRoute } from "@tanstack/react-router";
import { parseOptionalUuid } from "@/lib/uuid";
import FundsView from "@/views/funds";

export const Route = createFileRoute("/_workspace/funds")({
	validateSearch: (search: Record<string, unknown>): { caseId?: string } => ({
		caseId: parseOptionalUuid(search.caseId),
	}),
	component: FundsView,
});
