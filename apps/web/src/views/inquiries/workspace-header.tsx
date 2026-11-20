/**
 * @file 笔录模块的统一标题及操作栏。
 * 创建时间：2026-11-04；修改时间：2026-11-20。
 * 版本作用：让编辑工具直接占用工作区标题栏，并支持子视图面包屑层级提示。
 * 被调用：InquiriesView、InquiryRecordEditor；调用：WorkspaceHeader、WorkspaceTitle 与 Lucide 图标。
 * 预期结果：宽屏标题与工具同行，子视图呈现「笔录 › 子视图」，空间不足时自然换行。
 */
import { ChevronRightIcon, NotebookPenIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";

export default function InquiryWorkspaceHeader({
	subtitle,
	children,
}: {
	subtitle?: string;
	children?: ReactNode;
}) {
	return (
		<WorkspaceHeader>
			<div className="flex min-w-0 items-center gap-2">
				<WorkspaceTitle icon={NotebookPenIcon}>笔录</WorkspaceTitle>
				{subtitle && (
					<>
						<ChevronRightIcon
							aria-hidden="true"
							className="size-4 shrink-0 text-muted-foreground"
						/>
						<span className="truncate text-muted-foreground text-sm">
							{subtitle}
						</span>
					</>
				)}
			</div>
			{children}
		</WorkspaceHeader>
	);
}
