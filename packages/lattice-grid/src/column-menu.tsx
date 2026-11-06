/**
 * @file 表头列操作的紧凑下拉菜单。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 版本作用：沿用 ReUI c-dropdown-menu-4 的分组菜单结构，列操作由 GridStore 执行。
 * 被调用：DataGrid 表头；调用：共享 DropdownMenu、Button 与 GridStore。
 * 预期结果：列操作使用菜单键盘交互；结构变化后焦点返回当前列或表格，边界操作禁用。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leonwillow-electron/ui/components/dropdown-menu";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	EyeOffIcon,
	MoreHorizontalIcon,
	PinIcon,
	PinOffIcon,
	XIcon,
} from "lucide-react";
import { useRef } from "react";
import type { GridStore } from "./core/store";
import type { Column } from "./core/types";
import type { GridView } from "./view-controller";

export function ColumnMenu<T>({
	store,
	column,
	view,
}: {
	store: GridStore<T>;
	column: Column<T>;
	view: GridView<T>;
}) {
	const popupRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const returnFocus = useRef(true);
	const { state } = store.getSnapshot();
	const columnState = state.columns.find((item) => item.id === column.id);
	const sorted = state.sorting.some((item) => item.id === column.id);
	const canMoveLeft = store.canMoveColumn(column.id, -1);
	const canMoveRight = store.canMoveColumn(column.id, 1);
	const label = `${column.header}：列设置`;
	const focusTarget = () => {
		if (!view.root?.isConnected) return false;
		const header = [
			...view.root.querySelectorAll<HTMLElement>(".lg-header[data-value]"),
		].find((element) => element.dataset.value === column.id);
		return (
			header?.querySelector<HTMLElement>("[data-lg-column-menu]") ??
			(view.scroller?.isConnected ? view.scroller : false)
		);
	};
	const changeColumnStructure = (change: () => void) => {
		const doc = view.root?.ownerDocument;
		const previousActive = doc?.activeElement;
		const popup = popupRef.current;
		const trigger = triggerRef.current;
		change();
		// Base UI resolves finalFocus during layout cleanup, before a replacement header is mounted.
		// Only the structural command gets a post-commit fallback; outside clicks keep their focus.
		doc?.defaultView?.requestAnimationFrame(() => {
			if (!returnFocus.current) return;
			const target = focusTarget();
			const active = doc.activeElement;
			if (!target || active === target) return;
			if (
				active !== doc.body &&
				active !== previousActive &&
				active !== trigger &&
				!popup?.contains(active)
			)
				return;
			target.focus({ preventScroll: true });
		});
	};

	return (
		<DropdownMenu
			onOpenChange={(open, details) => {
				returnFocus.current =
					open ||
					(details.reason !== "outside-press" &&
						details.reason !== "focus-out" &&
						details.reason !== "sibling-open");
			}}
		>
			<DropdownMenuTrigger
				ref={triggerRef}
				data-lg-column-menu
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={label}
					/>
				}
			>
				<MoreHorizontalIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				ref={popupRef}
				align="start"
				className="w-40"
				aria-label={label}
				data-lg-interactive
				finalFocus={() => (returnFocus.current ? focusTarget() : false)}
			>
				{column.sortable !== false && (
					<>
						<DropdownMenuGroup>
							<DropdownMenuItem
								onClick={() => store.sort(column.id, false, "asc")}
							>
								<ArrowUpIcon />
								升序
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => store.sort(column.id, false, "desc")}
							>
								<ArrowDownIcon />
								降序
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!sorted}
								onClick={() => store.sort(column.id, false, "none")}
							>
								<XIcon />
								取消排序
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuGroup>
					<DropdownMenuItem
						onClick={() =>
							changeColumnStructure(() =>
								store.setColumn(column.id, { pinned: !columnState?.pinned }),
							)
						}
					>
						{columnState?.pinned ? <PinOffIcon /> : <PinIcon />}
						{columnState?.pinned ? "取消冻结列" : "冻结列"}
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() =>
							changeColumnStructure(() =>
								store.setColumn(column.id, { hidden: true }),
							)
						}
					>
						<EyeOffIcon />
						隐藏列
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						disabled={!canMoveLeft}
						aria-label={canMoveLeft ? "向左移动" : "向左移动：已到当前区域边界"}
						onClick={() => store.moveColumn(column.id, -1)}
					>
						<ArrowLeftIcon />
						向左移动
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!canMoveRight}
						aria-label={
							canMoveRight ? "向右移动" : "向右移动：已到当前区域边界"
						}
						onClick={() => store.moveColumn(column.id, 1)}
					>
						<ArrowRightIcon />
						向右移动
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
