/**
 * @file 文书取号的 CSR 文件路由。
 * 创建时间：2026-10-10；修改时间：2026-11-18。
 * 版本作用：按需加载真实模板目录，避免将文书客户端打入首屏入口，页面交互位于 views/documents。
 * 被调用：TanStack Router；调用：文书 Eden 客户端、专用视图。
 * 预期结果：父路由检查会话和 documents 授权，故障可重试。
 */
import { createFileRoute } from "@tanstack/react-router";
import { parseOptionalUuid } from "@/lib/uuid";
import DocumentsView from "@/views/documents";
import {
	DocumentsErrorView,
	DocumentsPendingView,
} from "@/views/documents/route-states";

export const Route = createFileRoute("/_workspace/documents")({
	validateSearch: (
		search: Record<string, unknown>,
	): { typeId?: string; view?: "templates" } => ({
		typeId: parseOptionalUuid(search.typeId),
		view: search.view === "templates" ? "templates" : undefined,
	}),
	loader: async () => {
		const { listDocumentCatalog, listDocumentTypes } = await import(
			"@/lib/documents"
		);
		const [types, catalog] = await Promise.all([
			listDocumentTypes(),
			listDocumentCatalog(),
		]);
		return { types, catalog };
	},
	staleTime: 0,
	preloadStaleTime: 0,
	component: DocumentsView,
	pendingComponent: DocumentsPendingView,
	errorComponent: DocumentsErrorView,
});
