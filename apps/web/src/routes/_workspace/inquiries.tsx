/**
 * @file 笔录工作区的 CSR 文件路由及选择参数。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：父路由执行真实会话和 inquiries 授权；视图负责业务展示。
 * 被调用：TanStack Router；调用：InquiriesView。
 * 预期结果：案件和笔录可刷新直达，非法 ID 不触发业务请求。
 */
import { createFileRoute } from "@tanstack/react-router";
import InquiriesView from "@/views/inquiries";

const id = (value: unknown) =>
	typeof value === "string" &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	)
		? value
		: undefined;
export const Route = createFileRoute("/_workspace/inquiries")({
	validateSearch: (
		search: Record<string, unknown>,
	): {
		inquiryCaseId?: string;
		recordId?: string;
		inquiryView?: "inquirers";
	} => ({
		inquiryCaseId: id(search.inquiryCaseId),
		recordId: id(search.inquiryCaseId) ? id(search.recordId) : undefined,
		inquiryView: search.inquiryView === "inquirers" ? "inquirers" : undefined,
	}),
	component: InquiriesView,
});
