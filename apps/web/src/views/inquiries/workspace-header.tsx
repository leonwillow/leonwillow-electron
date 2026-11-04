/**
 * @file 笔录模块的统一标题及操作栏。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：让编辑工具直接占用工作区标题栏，避免重复的顶部操作行。
 * 被调用：InquiriesView、InquiryRecordEditor；调用：共享工作区尺寸与 Lucide 图标。
 * 预期结果：宽屏标题与工具同行，空间不足时自然换行，所有操作均可访问。
 */
import { NotebookPenIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function InquiryWorkspaceHeader({
	children,
}: {
	children?: ReactNode;
}) {
	return (
		<header
			data-slot="workspace-header"
			className="flex min-h-workspace-header shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-workspace-gutter py-2"
		>
			<h1 className="flex shrink-0 items-center gap-2 font-semibold text-base">
				<NotebookPenIcon aria-hidden="true" className="size-4" />
				笔录
			</h1>
			{children}
		</header>
	);
}
