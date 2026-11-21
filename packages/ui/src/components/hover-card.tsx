/**
 * @file 悬停预览卡基础组件。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-20
 * 版本作用：适配 shadcn base-mira HoverCard，复用已安装的 Base UI PreviewCard。
 * 被调用：资金账户目录、工作台二级菜单及目录摘要；调用：PreviewCard、共享 cn。
 * 功能：提供延迟悬停、移入卡片及其提示保持打开、Escape 关闭与视口避让，未完成定位首帧禁用指针命中。
 * 预期结果：预览使用共享浮层样式且不抢占触发器悬停命中，内容和数据由业务提供。
 */
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { TooltipPortalScope } from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";

function HoverCard<Payload>({
	...props
}: PreviewCardPrimitive.Root.Props<Payload>) {
	return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger<Payload>({
	...props
}: PreviewCardPrimitive.Trigger.Props<Payload>) {
	return (
		<PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
	);
}

function HoverCardContent({
	className,
	side = "bottom",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	children,
	showArrow = false,
	anchor,
	collisionPadding,
	...props
}: PreviewCardPrimitive.Popup.Props & { showArrow?: boolean } & Pick<
		PreviewCardPrimitive.Positioner.Props,
		| "align"
		| "alignOffset"
		| "side"
		| "sideOffset"
		| "anchor"
		| "collisionPadding"
	>) {
	return (
		<PreviewCardPrimitive.Portal>
			<PreviewCardPrimitive.Positioner
				anchor={anchor}
				collisionPadding={collisionPadding}
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-(--z-floating)"
				render={(positionerProps) => {
					const unpositioned =
						positionerProps.style?.opacity === 0 ||
						positionerProps.style?.opacity === "0";
					// Base UI 定位前的首帧将浮层置于 (0, 0) 且仅隐藏透明度，需禁用指针命中以免盖住左侧栏触发器导致 :hover 闪烁。
					return (
						<div
							{...positionerProps}
							style={
								unpositioned
									? { ...positionerProps.style, pointerEvents: "none" }
									: positionerProps.style
							}
						/>
					);
				}}
			>
				{/* 保持定位后的渐显与缩放，避免滑入位移遮挡触发器边缘导致悬停闪烁。 */}
				<PreviewCardPrimitive.Popup
					data-slot="hover-card-content"
					className={cn(
						"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 ring-(length:--ui-border-width) z-(--z-floating) w-72 max-w-(--available-width) origin-(--transform-origin) rounded-lg bg-popover p-2.5 text-popover-foreground text-xs shadow-md outline-hidden ring-ui-outline duration-100 data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					<TooltipPortalScope>{children}</TooltipPortalScope>
					{showArrow && (
						<PreviewCardPrimitive.Arrow
							data-slot="hover-card-arrow"
							className="pointer-events-none size-3 rotate-45 border-ui-outline bg-popover data-[side=bottom]:-top-1.5 data-[side=left]:-right-1.5 data-[side=top]:-bottom-1.5 data-[side=right]:-left-1.5 data-uncentered:hidden data-[side=bottom]:border-t data-[side=left]:border-t data-[side=left]:border-r data-[side=top]:border-r data-[side=right]:border-b data-[side=top]:border-b data-[side=bottom]:border-l data-[side=right]:border-l"
						/>
					)}
				</PreviewCardPrimitive.Popup>
			</PreviewCardPrimitive.Positioner>
		</PreviewCardPrimitive.Portal>
	);
}

const createHoverCardHandle = PreviewCardPrimitive.createHandle;

export { createHoverCardHandle, HoverCard, HoverCardContent, HoverCardTrigger };
