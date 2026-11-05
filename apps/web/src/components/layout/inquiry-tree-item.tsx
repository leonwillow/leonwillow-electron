/**
 * @file 笔录 ReUI 树的文件夹、笔录和加载操作行。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：在官方 TreeItem/TreeItemLabel 上组合业务图标和同行操作。
 * 被调用：useInquiryCaseMenu；调用：共享 Tree、Tooltip 和笔录操作按钮。
 * 预期结果：左侧箭头与文件图标对齐，行操作不触发展开或导航；名称渐隐并可悬停滚动，操作区预留位置。
 */
import type { ItemInstance } from "@headless-tree/core";
import { MenuLabel } from "@leonwillow-electron/ui/components/menu-label";
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
			size="icon-xs"
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
}: {
	item: ItemInstance<InquiryTreeNode>;
	busy: boolean;
	onRename: (row: InquiryCase) => void;
	onArchive: (row: InquiryCase) => void;
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
			data-menu-row
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
				<MenuLabel>{label}</MenuLabel>
				{row && node.kind === "folder" && (
					<span className="invisible flex shrink-0 items-center gap-1 group-focus-within/entry:visible group-hover/entry:visible [@media(hover:none)]:visible">
						{node.kind === "folder" && (
							<>
								<RowAction
									label={`重命名 ${row.name}`}
									variant="info"
									disabled={busy}
									disabledReason="正在处理目录操作，请稍候"
									onClick={() => onRename(row)}
								>
									<PencilIcon className="size-3" />
								</RowAction>
								<RowAction
									label={`${row.archived ? "恢复" : "归档"} ${row.name}`}
									variant="warning"
									disabled={busy}
									disabledReason="正在处理目录操作，请稍候"
									onClick={() => onArchive(row)}
								>
									{row.archived ? (
										<ArchiveRestoreIcon className="size-3" />
									) : (
										<ArchiveIcon className="size-3" />
									)}
								</RowAction>
							</>
						)}
					</span>
				)}
			</TreeItemLabel>
		</TreeItem>
	);
}
