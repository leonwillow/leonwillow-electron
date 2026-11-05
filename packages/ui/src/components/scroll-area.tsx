/**
 * @file 共享的双向滚动区域与自定义滚动条。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：沿用 shadcn base-mira / Base UI Scroll Area，适配工作台弹层与分栏。
 * 被调用：菜单、编辑器、表格和长表单；调用：Base UI ScrollArea、共享 cn。
 * 功能与预期结果：滚轮、触控、键盘和拖动滚动条使用官方逻辑；viewportProps 将虚拟列表引用绑定到实际滚动节点。
 */
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@leonwillow-electron/ui/lib/utils";

function ScrollArea({
	className,
	children,
	viewportProps,
	contentClassName,
	contentRender,
	...props
}: ScrollAreaPrimitive.Root.Props & {
	viewportProps?: ScrollAreaPrimitive.Viewport.Props;
	contentClassName?: string;
	contentRender?: ScrollAreaPrimitive.Content.Props["render"];
}) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn("scroll-area", className)}
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				{...viewportProps}
				data-slot="scroll-area-viewport"
				className={cn("scroll-area-viewport", viewportProps?.className)}
			>
				<ScrollAreaPrimitive.Content
					data-slot="scroll-area-content"
					render={contentRender}
					className={cn("scroll-area-content", contentClassName)}
				>
					{children}
				</ScrollAreaPrimitive.Content>
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollBar orientation="horizontal" />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
	return (
		<ScrollAreaPrimitive.Scrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn("scroll-area-scrollbar", className)}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				data-slot="scroll-area-thumb"
				className="scroll-area-thumb"
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
}

export { ScrollArea, ScrollBar };
