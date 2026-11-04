/**
 * @file 独立笔录与案件内笔录的共用创建流程。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：按目标文件夹保留创建请求 ID，切换目录后重试不产生重复笔录。
 * 被调用：笔录目录与未选择引导；调用：Eden、草稿工厂、导航上下文。
 * 预期结果：保存成功后刷新目录并打开编辑器，失败保留请求供重试。
 */
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useInquiryNavigation } from "@/components/layout/inquiry-navigation-provider";
import {
	createInquiryRecord,
	createStandaloneInquiry,
	inquiryError,
} from "@/lib/inquiries";
import { createInquiryDraft } from "./draft";

/** caseId 是默认目标，create 可指定其他文件夹；请求状态由调用方的挂载生命周期持有。 */
export function useCreateInquiry(caseId?: string) {
	const navigate = useNavigate();
	const menu = useInquiryNavigation();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const lock = useRef(false);
	const pending = useRef(
		new Map<
			string | undefined,
			{ id: string; draft: ReturnType<typeof createInquiryDraft> }
		>(),
	);
	const create = async (targetCaseId = caseId) => {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setError("");
		let request = pending.current.get(targetCaseId);
		if (!request) {
			request = {
				id: crypto.randomUUID(),
				draft: createInquiryDraft(),
			};
			pending.current.set(targetCaseId, request);
		}
		try {
			const { draft, id } = request;
			const record = targetCaseId
				? await createInquiryRecord(targetCaseId, draft, id)
				: await createStandaloneInquiry(draft, id);
			menu.resetFilters();
			void menu.cases.reload();
			await navigate({
				to: "/inquiries",
				search: { inquiryCaseId: record.caseId, recordId: record.id },
			});
			pending.current.delete(targetCaseId);
		} catch (cause) {
			setError(inquiryError(cause));
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
	return { create, busy, error };
}
