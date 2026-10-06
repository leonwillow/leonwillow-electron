/**
 * @file Canvas 节点的鼠标位置菜单。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：复用共享 Base UI 菜单的键盘、碰撞避让和关闭行为。
 * 被调用：analysis-panel；调用：DropdownMenu 与节点操作回调。
 * 功能：详情、下钻、标记和可恢复的隐藏。
 * 预期结果：画布右键和目录键盘菜单使用同一套操作。
 */
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import {
	ArrowDownToLineIcon,
	EyeOffIcon,
	InfoIcon,
	PaintbrushIcon,
	RotateCcwIcon,
} from "lucide-react";
import { useMemo } from "react";

export type NodeMenuTarget = { id: string; x: number; y: number };
export default function NodeActionMenu({
	target,
	name,
	hidden,
	marked,
	onClose,
	onDetails,
	onDrill,
	onMark,
	onHide,
	onReset,
}: {
	target: NodeMenuTarget;
	name: string;
	hidden: boolean;
	marked: boolean;
	onClose: () => void;
	onDetails: () => void;
	onDrill: () => void;
	onMark: () => void;
	onHide: () => void;
	onReset: () => void;
}) {
	const anchor = useMemo(
		() => ({
			getBoundingClientRect: () => new DOMRect(target.x, target.y, 0, 0),
		}),
		[target.x, target.y],
	);
	return (
		<DropdownMenu
			open
			modal={false}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DropdownMenuContent
				anchor={anchor}
				className="w-48"
				finalFocus={false}
				aria-label={`${name}的节点操作`}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
					<DropdownMenuItem onClick={onDetails}>
						<InfoIcon />
						显示详情
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onDrill}>
						<ArrowDownToLineIcon />
						下钻分析
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={onMark}>
						<PaintbrushIcon />
						特殊标记
					</DropdownMenuItem>
					{marked && (
						<DropdownMenuItem onClick={onReset}>
							<RotateCcwIcon />
							恢复默认样式
						</DropdownMenuItem>
					)}
					<DropdownMenuItem onClick={onHide}>
						<EyeOffIcon />
						{hidden ? "恢复显示" : "隐藏节点"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
