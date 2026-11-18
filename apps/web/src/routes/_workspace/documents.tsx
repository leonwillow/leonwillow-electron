/**
 * @file 文书取号的 CSR 文件路由。
 * 创建时间：2026-10-10；修改时间：2026-11-18。
 * 版本作用：仅校验路由查询参数并挂载视图，目录与模板状态统一由 DocumentNavigationProvider 按需加载共享。
 * 被调用：TanStack Router；调用：parseOptionalUuid、DocumentsView。
 * 预期结果：父路由检查会话和 documents 授权，不再与二级菜单重复请求目录。
 */
import { createFileRoute } from "@tanstack/react-router";
import { parseOptionalUuid } from "@/lib/uuid";
import DocumentsView from "@/views/documents";

export const Route = createFileRoute("/_workspace/documents")({
	validateSearch: (
		search: Record<string, unknown>,
	): { typeId?: string; view?: "templates" } => ({
		typeId: parseOptionalUuid(search.typeId),
		view: search.view === "templates" ? "templates" : undefined,
	}),
	component: DocumentsView,
});
