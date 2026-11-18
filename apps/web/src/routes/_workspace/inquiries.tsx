/**
 * @file 笔录工作区的 CSR 文件路由及选择参数。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：父路由执行真实会话和 inquiries 授权；视图负责业务展示。
 * 被调用：TanStack Router；调用：InquiriesView。
 * 预期结果：案件和笔录可刷新直达，非法 ID 不触发业务请求。
 */
import { createFileRoute } from "@tanstack/react-router";
import { parseOptionalUuid } from "@/lib/uuid";
import InquiriesView from "@/views/inquiries";

export const Route = createFileRoute("/_workspace/inquiries")({
	validateSearch: (
		search: Record<string, unknown>,
	): {
		inquiryCaseId?: string;
		recordId?: string;
		inquiryView?: "inquirers";
	} => {
		const inquiryCaseId = parseOptionalUuid(search.inquiryCaseId);
		return {
			inquiryCaseId,
			recordId: inquiryCaseId ? parseOptionalUuid(search.recordId) : undefined,
			inquiryView: search.inquiryView === "inquirers" ? "inquirers" : undefined,
		};
	},
	component: InquiriesView,
});
