/**
 * @file Base UI 右键菜单，沿用共享下拉菜单的项目样式。
 * 创建时间：2026-11-06；修改时间：2026-11-06。
 * 版本作用：适配 shadcn base-mira ContextMenu，长内容由 ScrollArea 承载。
 * 被调用：Lattice Grid；调用：Base UI ContextMenu 各部件、共享 ScrollArea 和主题。
 * 预期结果：原生右键/长按定位、键盘和焦点行为由官方组件管理。
 */
import { ContextMenu as Primitive } from "@base-ui/react/context-menu";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";

export const ContextMenu = Primitive.Root;
export const ContextMenuTrigger = Primitive.Trigger;
export const ContextMenuGroup = Primitive.Group;

export function ContextMenuItem({ className, ...props }: Primitive.Item.Props) {
	return (
		<Primitive.Item
			data-slot="context-menu-item"
			className={cn(
				"relative flex min-h-7 cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

export function ContextMenuSeparator({
	className,
	...props
}: Primitive.Separator.Props) {
	return (
		<Primitive.Separator
			data-slot="context-menu-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export function ContextMenuContent({
	className,
	children,
	...props
}: Primitive.Popup.Props) {
	return (
		<Primitive.Portal>
			<Primitive.Positioner
				side="right"
				align="start"
				sideOffset={0}
				alignOffset={4}
				className="isolate z-50 outline-none"
			>
				<Primitive.Popup
					data-slot="context-menu-content"
					className={cn(
						"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 flex max-h-(--available-height) min-w-32 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					<ScrollArea contentClassName="p-1">{children}</ScrollArea>
				</Primitive.Popup>
			</Primitive.Positioner>
		</Primitive.Portal>
	);
}
