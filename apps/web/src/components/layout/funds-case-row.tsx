/**
 * @file 案件列表行及其提示按钮。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：案件操作仅在悬停/键盘操作时显示，原生拖放调整分组内顺序。
 * 被调用：FundsCaseSidebar；调用：共享 Button/Tooltip、TanStack Router。
 * 预期结果：点击选择不留下操作图标；拖动不触发导航，键盘 Alt+方向键亦可排序。
 */
import {
	Button,
	buttonVariants,
} from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	FolderIcon,
	PinIcon,
	PinOffIcon,
	Trash2Icon,
} from "lucide-react";
import type { ComponentProps, DragEvent } from "react";
import type { listFundsCases } from "@/lib/funds";
export type CaseRecord = Awaited<ReturnType<typeof listFundsCases>>[number];
export type DropTarget = { id: string; placement: "before" | "after" };

export function CaseIconAction({
	label,
	keepTooltipOnClick = false,
	...props
}: ComponentProps<typeof Button> & {
	label: string;
	keepTooltipOnClick?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				closeOnClick={!keepTooltipOnClick}
				render={
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label={label}
						{...props}
					/>
				}
			/>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

export default function FundsCaseRow({
	record,
	selected,
	archived,
	busy,
	to,
	dragging,
	dropTarget,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
	onKeyboardMove,
	onSelect,
	onUpdate,
	onDelete,
}: {
	record: CaseRecord;
	selected: boolean;
	archived: boolean;
	busy: boolean;
	to: "/funds" | "/funds/cases";
	dragging: string;
	dropTarget: DropTarget | null;
	onDragStart: (record: CaseRecord, event: DragEvent) => void;
	onDragEnd: () => void;
	onDragOver: (record: CaseRecord, event: DragEvent) => void;
	onDrop: (record: CaseRecord, event: DragEvent) => void;
	onKeyboardMove: (record: CaseRecord, direction: -1 | 1) => void;
	onSelect: () => void;
	onUpdate: (
		record: CaseRecord,
		patch: { pinned?: boolean; archived?: boolean },
	) => void;
	onDelete: (record: CaseRecord) => void;
}) {
	return (
		<li
			onDragOver={(e) => onDragOver(record, e)}
			onDrop={(e) => onDrop(record, e)}
			className={cn(
				"group/case relative flex items-center rounded-lg hover:bg-sidebar-accent has-[:focus-visible]:bg-sidebar-accent",
				selected && "bg-sidebar-accent",
				dragging === record.id && "opacity-40",
				dropTarget?.id === record.id &&
					"before:absolute before:inset-x-2 before:z-10 before:h-0.5 before:bg-primary",
				dropTarget?.id === record.id &&
					(dropTarget.placement === "before"
						? "before:top-0"
						: "before:bottom-0"),
			)}
		>
			<Link
				to={to}
				search={{ caseId: record.id }}
				activeOptions={{ exact: true }}
				aria-current={selected ? "page" : undefined}
				draggable={!busy}
				onDragStart={(e) => onDragStart(record, e)}
				onDragEnd={onDragEnd}
				onClick={(e) => {
					if (dragging) e.preventDefault();
					else onSelect();
				}}
				onKeyDown={(e) => {
					if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
						e.preventDefault();
						onKeyboardMove(record, e.key === "ArrowUp" ? -1 : 1);
					}
				}}
				aria-describedby="case-sort-help"
				className={cn(
					buttonVariants({ variant: "ghost", size: "lg" }),
					"min-w-0 flex-1 justify-start pr-16",
				)}
				title={record.name}
			>
				<FolderIcon />
				<span className="min-w-0 truncate">{record.name}</span>
			</Link>
			<div className="pointer-events-none absolute right-1 flex opacity-0 group-hover/case:pointer-events-auto group-hover/case:opacity-100 group-has-[:focus-visible]/case:pointer-events-auto group-has-[:focus-visible]/case:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
				{!archived && (
					<CaseIconAction
						label={record.pinned ? "取消置顶" : "置顶案件"}
						variant="success"
						disabled={busy}
						aria-pressed={record.pinned}
						onClick={() => onUpdate(record, { pinned: !record.pinned })}
					>
						{record.pinned ? <PinOffIcon /> : <PinIcon />}
					</CaseIconAction>
				)}
				<CaseIconAction
					label={archived ? "恢复案件" : "归档案件"}
					variant={archived ? "success" : "warning"}
					disabled={busy}
					onClick={() => onUpdate(record, { archived: !archived })}
				>
					{archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
				</CaseIconAction>
				{archived && (
					<CaseIconAction
						label="删除案件"
						variant="destructive"
						disabled={busy}
						onClick={() => onDelete(record)}
					>
						<Trash2Icon />
					</CaseIconAction>
				)}
			</div>
		</li>
	);
}
