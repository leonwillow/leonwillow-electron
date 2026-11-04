/**
 * @file 笔录 ReUI 树的文件夹、笔录和加载操作行。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：在官方 TreeItem/TreeItemLabel 上组合业务图标和同行操作。
 * 被调用：useInquiryCaseMenu；调用：共享 Tree、Tooltip 和笔录操作按钮。
 * 预期结果：左侧箭头与文件图标对齐，行操作不触发展开或导航；名称截断后可查看全文。
 */
import type { ItemInstance } from "@headless-tree/core";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import {
	TreeItem,
	TreeItemLabel,
} from "@leonwillow-electron/ui/components/tree";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FileIcon,
	FolderClosedIcon,
	FolderOpenIcon,
	LoaderCircleIcon,
	PencilIcon,
	PlusIcon,
	RotateCwIcon,
	Trash2Icon,
} from "lucide-react";
import type { ComponentProps } from "react";
import type { InquiryCase } from "@/lib/inquiries";
import { InquiryIconButton } from "@/views/inquiries/controls";
import type { InquiryTreeNode } from "./use-inquiry-tree";

/** 行内操作隔离树键盘/点击事件，避免重命名或归档时展开文件夹。 */
function RowAction({
	onClick,
	...props
}: ComponentProps<typeof InquiryIconButton>) {
	return (
		<InquiryIconButton
			{...props}
			onKeyDownCapture={(event) => event.stopPropagation()}
			onClick={(event) => {
				event.stopPropagation();
				onClick?.(event);
			}}
		/>
	);
}

export default function InquiryTreeItem({
	item,
	busy,
	onRename,
	onArchive,
	onRemove,
}: {
	item: ItemInstance<InquiryTreeNode>;
	busy: boolean;
	onRename: (row: InquiryCase) => void;
	onArchive: (row: InquiryCase) => void;
	onRemove: (row: InquiryCase, record?: InquiryTreeNode["record"]) => void;
}) {
	const node = item.getItemData();
	const label = node.error ? `${node.name}：${node.error}` : node.name;
	const row = node.row;
	const Icon =
		node.kind === "folder"
			? item.isExpanded()
				? FolderOpenIcon
				: FolderClosedIcon
			: node.kind === "record"
				? FileIcon
				: node.kind === "create"
					? PlusIcon
					: node.kind === "error"
						? RotateCwIcon
						: node.kind === "previous"
							? ChevronLeftIcon
							: node.kind === "next"
								? ChevronRightIcon
								: node.kind === "loading"
									? LoaderCircleIcon
									: FileIcon;
	return (
		<TreeItem
			item={item}
			render={<div />}
			className="group/entry"
			aria-label={label}
			aria-disabled={node.disabled || undefined}
			data-disabled={node.disabled || undefined}
		>
			<TreeItemLabel>
				<Icon
					className={
						node.kind === "loading"
							? "animate-spin text-muted-foreground"
							: "text-muted-foreground"
					}
				/>
				<TooltipText content={label}>
					<span className="min-w-0 flex-1 truncate text-left">{label}</span>
				</TooltipText>
				{row && (node.kind === "folder" || node.kind === "record") && (
					<span className="hidden shrink-0 items-center gap-1 group-focus-within/entry:flex group-hover/entry:flex [@media(hover:none)]:flex">
						{node.kind === "folder" && (
							<>
								<RowAction
									label={`重命名 ${row.name}`}
									disabled={busy}
									onClick={() => onRename(row)}
								>
									<PencilIcon />
								</RowAction>
								<RowAction
									label={`${row.archived ? "恢复" : "归档"} ${row.name}`}
									disabled={busy}
									onClick={() => onArchive(row)}
								>
									{row.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
								</RowAction>
							</>
						)}
						<RowAction
							label={
								node.kind === "record"
									? row.archived
										? "请先恢复案件再删除笔录"
										: `删除笔录 ${node.name}`
									: row.archived
										? `删除 ${row.name}`
										: "请先归档案件再删除"
							}
							disabled={
								busy || (node.kind === "folder" ? !row.archived : row.archived)
							}
							onClick={() => onRemove(row, node.record)}
						>
							<Trash2Icon />
						</RowAction>
					</span>
				)}
			</TreeItemLabel>
		</TreeItem>
	);
}
