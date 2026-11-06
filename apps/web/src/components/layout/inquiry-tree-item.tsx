/**
 * @file 笔录 ReUI 树的文件夹、笔录和加载操作行。
 * 创建时间：2026-11-04；修改时间：2026-11-06。
 * 版本作用：在官方 TreeItem/TreeItemLabel 上组合业务图标及同行新建、改名和归档。
 * 被调用：useInquiryCaseMenu；调用：共享 Tree、目录摘要预览和笔录操作按钮。
 * 预期结果：文件图标对齐，名称使用可用宽度；悬停时同行操作贴右显示且不触发展开或导航。
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
import type { InquiryCase, InquiryRow } from "@/lib/inquiries";
import { InquiryIconButton } from "@/views/inquiries/controls";
import { readInquirySchedule } from "@/views/inquiries/inquiry-schedule";
import { DirectoryItemLabel } from "./directory-item-label";
import type { InquiryTreeNode } from "./use-inquiry-tree";

/** 直接使用目录摘要；本地询问日期不转换时区，空字段与真实填写内容明确区分。 */
function previewDetails(record: InquiryRow) {
	const schedule = readInquirySchedule(record);
	const end =
		schedule.endDate && schedule.endDate !== schedule.date
			? `${schedule.endDate} ${schedule.endTime || "未填写"}`
			: schedule.endTime || "未填写";
	const details = [
		{ label: "询问日期", value: schedule.date || "未填写" },
		{ label: "调查人", value: record.inquirerNames.join("、") || "未填写" },
		{ label: "被询问人", value: record.subjectName.trim() || "未填写" },
	];
	if (schedule.startTime || schedule.endTime)
		details.splice(1, 0, {
			label: "询问时间",
			value: `${schedule.startTime || "未填写"} — ${end}`,
		});
	if (record.subjectOrg.trim())
		details.push({ label: "所属单位", value: record.subjectOrg });
	if (record.inquiryLocation.trim())
		details.push({ label: "询问地点", value: record.inquiryLocation });
	return details;
}

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
	onCreate,
	onRename,
	onArchive,
	onRenameRecord,
	onArchiveRecord,
}: {
	item: ItemInstance<InquiryTreeNode>;
	busy: boolean;
	onCreate?: (caseId: string) => void;
	onRename: (row: InquiryCase) => void;
	onArchive: (row: InquiryCase) => void;
	onRenameRecord: (
		row: InquiryCase,
		record: Pick<InquiryRow, "id" | "title" | "revision" | "archived">,
	) => void;
	onArchiveRecord: (
		row: InquiryCase,
		record: Pick<InquiryRow, "id" | "title" | "revision" | "archived">,
	) => void;
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
				{row && (node.kind === "folder" || node.record) ? (
					<DirectoryItemLabel
						name={label}
						icon={Icon}
						category={
							node.kind === "folder"
								? "笔录案件文件夹"
								: row.kind === "standalone"
									? "独立笔录"
									: `所属文件夹 · ${row.name}`
						}
						status={row.archived || node.record?.archived ? "已归档" : "使用中"}
						updatedAt={node.record?.updatedAt ?? row.updatedAt}
						details={node.record ? previewDetails(node.record) : undefined}
					/>
				) : (
					<MenuLabel>{label}</MenuLabel>
				)}
				{row && (node.kind === "folder" || node.record) && (
					<span className="menu-row-actions">
						{node.kind === "folder" && !row.archived && onCreate && (
							<RowAction
								label={`在 ${node.name} 中新建笔录`}
								disabled={busy}
								disabledReason="正在处理目录操作，请稍候"
								onClick={() => onCreate(row.id)}
							>
								<PlusIcon />
							</RowAction>
						)}
						<RowAction
							label={`重命名 ${node.name}`}
							variant="info"
							disabled={busy || (!!node.record && row.archived)}
							disabledReason={
								busy ? "正在处理目录操作，请稍候" : "请先恢复所属案件文件夹"
							}
							onClick={() =>
								node.record ? onRenameRecord(row, node.record) : onRename(row)
							}
						>
							<PencilIcon />
						</RowAction>
						<RowAction
							label={`${row.archived || node.record?.archived ? "恢复" : "归档"} ${node.name}`}
							variant="warning"
							disabled={busy || (!!node.record && row.archived)}
							disabledReason={
								busy ? "正在处理目录操作，请稍候" : "请先恢复所属案件文件夹"
							}
							onClick={() =>
								node.record ? onArchiveRecord(row, node.record) : onArchive(row)
							}
						>
							{row.archived || node.record?.archived ? (
								<ArchiveRestoreIcon />
							) : (
								<ArchiveIcon />
							)}
						</RowAction>
					</span>
				)}
			</TreeItemLabel>
		</TreeItem>
	);
}
