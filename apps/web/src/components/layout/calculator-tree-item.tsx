/**
 * @file 计算器目录的分组、方案及操作行。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：沿用笔录 Tree 行及悬停操作，保留两种计算器图标。
 * 被调用：calculator-sidebar；调用：共享 Tree、目录摘要预览与图标操作控件。
 * 预期结果：未悬停时名称使用整行，悬停按钮贴右显示；操作不切换页面或折叠分组。
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
	FileIcon,
	LoaderCircleIcon,
	PencilIcon,
	PlusIcon,
	RotateCwIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import {
	type CalculatorKind,
	type CalculatorSummary,
	calculatorDirectory,
} from "@/lib/calculator-directory";
import { InquiryIconButton } from "@/views/inquiries/controls";
import { DirectoryItemLabel } from "./directory-item-label";
export type CalculatorNode = {
	name: string;
	kind: CalculatorKind;
	type: "group" | "record" | "loading" | "error";
	row?: CalculatorSummary;
};
function Action({
	onClick,
	...props
}: ComponentProps<typeof InquiryIconButton>) {
	return (
		<InquiryIconButton
			size="icon-xs"
			{...props}
			onKeyDownCapture={(e) => e.stopPropagation()}
			onClick={(e) => {
				e.stopPropagation();
				onClick?.(e);
			}}
		/>
	);
}
export default function CalculatorTreeItem({
	item,
	selected,
	busy,
	onRename,
	onArchive,
	onCreate,
}: {
	item: ItemInstance<CalculatorNode>;
	selected: boolean;
	busy: boolean;
	onRename: (kind: CalculatorKind, row: CalculatorSummary) => void;
	onArchive: (kind: CalculatorKind, row: CalculatorSummary) => void;
	onCreate: (kind: CalculatorKind) => void;
}) {
	const node = item.getItemData();
	const row = node.row;
	const Icon =
		node.type === "group"
			? calculatorDirectory[node.kind].icon
			: node.type === "loading"
				? LoaderCircleIcon
				: node.type === "error"
					? RotateCwIcon
					: FileIcon;
	return (
		<TreeItem
			item={item}
			render={<div />}
			data-menu-row
			className="group/entry"
			data-selected={selected}
			aria-selected={selected}
			aria-disabled={busy || node.type === "loading"}
		>
			<TreeItemLabel>
				<Icon
					aria-hidden="true"
					className={
						node.type === "loading"
							? "animate-spin text-muted-foreground"
							: node.type === "group"
								? undefined
								: "text-muted-foreground"
					}
				/>
				{node.type === "record" || node.type === "group" ? (
					<DirectoryItemLabel
						name={node.name}
						icon={Icon}
						category={
							node.type === "group"
								? "计算器方案目录"
								: calculatorDirectory[node.kind].title
						}
						status={row ? (row.archived ? "已归档" : "使用中") : undefined}
						updatedAt={row?.updatedAt}
					/>
				) : (
					<MenuLabel>{node.name}</MenuLabel>
				)}
				{row && (
					<span className="menu-row-actions">
						<Action
							label={`重命名 ${row.name}`}
							variant="info"
							disabled={busy}
							disabledReason="正在处理目录操作"
							onClick={() => onRename(node.kind, row)}
						>
							<PencilIcon />
						</Action>
						<Action
							label={`${row.archived ? "恢复" : "归档"} ${row.name}`}
							variant="warning"
							disabled={busy}
							disabledReason="正在处理目录操作"
							onClick={() => onArchive(node.kind, row)}
						>
							{row.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
						</Action>
					</span>
				)}
				{node.type === "group" && (
					<span className="menu-row-actions">
						<Action
							label={`新建${node.name}方案`}
							disabled={busy}
							disabledReason="正在处理目录操作"
							onClick={() => onCreate(node.kind)}
						>
							<PlusIcon />
						</Action>
					</span>
				)}
			</TreeItemLabel>
		</TreeItem>
	);
}
