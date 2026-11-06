/**
 * @file 通用网格的单元格右键操作与批量插行请求。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 版本作用：菜单只传递稳定行身份、方向和数量，不生成业务字段。
 * 被调用：DataGrid；调用：Base UI ContextMenu、Dialog、GridView。
 * 预期结果：只读可复制；插入由宿主验证、保存，目标失效或正在提交时不执行。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@leonwillow-electron/ui/components/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { Field, FieldLabel } from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, Rows3Icon } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";
import { toast } from "sonner";
import type { CellPosition } from "./core/types";
import type { GridView } from "./view-controller";

export type InsertRowsRequest<T> = CellPosition & {
	row: T;
	position: "above" | "below";
	count: number;
};

export function CellContextMenu<T>({
	view,
	onInsertRows,
	children,
}: {
	view: GridView<T>;
	onInsertRows?: (request: InsertRowsRequest<T>) => void | Promise<void>;
	children: (trigger: ReactElement) => ReactNode;
}) {
	const [target, setTarget] = useState<CellPosition | null>(null);
	const [position, setPosition] = useState<"above" | "below" | null>(null);
	const [count, setCount] = useState("1");
	const [busy, setBusy] = useState(false);
	const snapshot = view.store.getSnapshot();
	const options = view.store.getOptions();
	const disabled =
		busy ||
		snapshot.pending ||
		!!options.readOnly ||
		!!options.loading ||
		!!options.error;
	const insert = async (side: "above" | "below", amount: number) => {
		if (!target || !onInsertRows || disabled) return;
		if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
			toast.error("请输入1至100的整数行数");
			return;
		}
		const row = view.store
			.getSnapshot()
			.rows.find((r) => options.getRowId(r) === target.rowId);
		if (!row) {
			toast.error("目标行已变化，请重新选择");
			return;
		}
		setBusy(true);
		try {
			await onInsertRows({ ...target, row, position: side, count: amount });
			setPosition(null);
		} catch (error) {
			toast.error("无法插入行", {
				description: error instanceof Error ? error.message : "请重试",
			});
		} finally {
			setBusy(false);
		}
	};
	return (
		<ContextMenu
			disabled={!!view.getSnapshot().editing}
			onOpenChange={(open, details) => {
				if (!open) return;
				const element =
					details.event.target instanceof Element ? details.event.target : null;
				if (element?.closest("input,textarea,button,[data-lg-interactive]")) {
					details.cancel();
					return;
				}
				const cell = element?.closest<HTMLElement>("[data-lg-cell]");
				const row = cell
					? snapshot.viewRows[Number(cell.dataset.row)]
					: undefined;
				const next =
					row && cell?.dataset.col
						? { rowId: options.getRowId(row), columnId: cell.dataset.col }
						: element === view.scroller
							? snapshot.state.selection?.focus
							: null;
				if (!next) {
					details.cancel();
					return;
				}
				view.store.select(next);
				setTarget(next);
			}}
		>
			{children(
				<ContextMenuTrigger
					onKeyDown={(event) => {
						if (
							event.target !== event.currentTarget ||
							!(
								event.key === "ContextMenu" ||
								(event.shiftKey && event.key === "F10")
							)
						)
							return;
						const doc = event.currentTarget.ownerDocument;
						const cell = doc.getElementById(
							event.currentTarget.getAttribute("aria-activedescendant") ?? "",
						);
						const MouseEvent = doc.defaultView?.MouseEvent;
						if (!cell || !MouseEvent) return;
						event.preventDefault();
						const rect = cell.getBoundingClientRect();
						cell.dispatchEvent(
							new MouseEvent("contextmenu", {
								bubbles: true,
								cancelable: true,
								clientX: rect.left + rect.width / 2,
								clientY: rect.top + rect.height / 2,
							}),
						);
					}}
				/>,
			)}
			<ContextMenuContent
				finalFocus={() => view.scroller}
				aria-label="单元格操作"
			>
				<ContextMenuGroup>
					<ContextMenuItem onClick={() => void view.copy()}>
						<CopyIcon />
						复制此单元格
					</ContextMenuItem>
				</ContextMenuGroup>
				{onInsertRows && (
					<>
						<ContextMenuSeparator />
						<ContextMenuGroup>
							<ContextMenuItem
								disabled={disabled}
								onClick={() => void insert("above", 1)}
							>
								<ArrowUpIcon />
								在上方插入一行
							</ContextMenuItem>
							<ContextMenuItem
								disabled={disabled}
								onClick={() => void insert("below", 1)}
							>
								<ArrowDownIcon />
								在下方插入一行
							</ContextMenuItem>
							<ContextMenuItem
								disabled={disabled}
								onClick={() => {
									setCount("1");
									setPosition("above");
								}}
							>
								<Rows3Icon />
								在上方插入多行…
							</ContextMenuItem>
							<ContextMenuItem
								disabled={disabled}
								onClick={() => {
									setCount("1");
									setPosition("below");
								}}
							>
								<Rows3Icon />
								在下方插入多行…
							</ContextMenuItem>
						</ContextMenuGroup>
					</>
				)}
			</ContextMenuContent>
			<Dialog
				open={!!position}
				onOpenChange={(open) => {
					if (!open && !busy) setPosition(null);
				}}
			>
				<DialogContent finalFocus={() => view.scroller}>
					<DialogHeader>
						<DialogTitle>
							在{position === "above" ? "上" : "下"}方插入行
						</DialogTitle>
						<DialogDescription>
							先插入空行，再填写每行的内容。
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor={`${view.options.id}-insert-count`}>
							行数
						</FieldLabel>
						<Input
							id={`${view.options.id}-insert-count`}
							type="number"
							min={1}
							max={100}
							value={count}
							onChange={(event) => setCount(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && position)
									void insert(position, Number(count));
							}}
						/>
					</Field>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setPosition(null)}
						>
							取消
						</Button>
						<Button
							disabled={disabled}
							onClick={() => position && void insert(position, Number(count))}
						>
							插入
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</ContextMenu>
	);
}
