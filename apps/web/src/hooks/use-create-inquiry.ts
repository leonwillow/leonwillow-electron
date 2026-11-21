/**
 * @file 独立笔录与案件内笔录的共用创建流程。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：按目标文件夹保留创建请求 ID，切换目录后重试不产生重复笔录。
 * 被调用：笔录目录与未选择引导；调用：Eden、笔录默认值工厂、导航上下文。
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
import { createInquiryDocument } from "@/lib/inquiry-schedule";
import { randomUUID } from "@/lib/uuid";

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
			{ id: string; draft: ReturnType<typeof createInquiryDocument> }
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
				id: randomUUID(),
				draft: createInquiryDocument(),
			};
			pending.current.set(targetCaseId, request);
		}
		try {
			const { draft, id } = request;
			const record = targetCaseId
				? await createInquiryRecord(targetCaseId, draft, id)
				: await createStandaloneInquiry(draft, id);
			// 创建成功后立即清理幂等请求，避免导航被拦截或异常时重试复用旧笔录 ID。
			pending.current.delete(targetCaseId);
			menu.resetFilters();
			void menu.cases.reload();
			await navigate({
				to: "/inquiries",
				search: { inquiryCaseId: record.caseId, recordId: record.id },
			});
		} catch (cause) {
			setError(inquiryError(cause));
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
	return { create, busy, error };
}
