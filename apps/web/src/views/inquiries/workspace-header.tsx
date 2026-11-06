/**
 * @file 笔录模块的统一标题及操作栏。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：让编辑工具直接占用工作区标题栏，避免重复的顶部操作行。
 * 被调用：InquiriesView、InquiryRecordEditor；调用：WorkspaceHeader、WorkspaceTitle 与 Lucide 图标。
 * 预期结果：宽屏标题与工具同行，空间不足时自然换行，所有操作均可访问。
 */
import { NotebookPenIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";

export default function InquiryWorkspaceHeader({
	children,
}: {
	children?: ReactNode;
}) {
	return (
		<WorkspaceHeader>
			<WorkspaceTitle icon={NotebookPenIcon}>笔录</WorkspaceTitle>
			{children}
		</WorkspaceHeader>
	);
}
