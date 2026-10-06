/**
 * @file 从原模板迁入的侧边详情窗口。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：共享 Base UI Sheet，支持不遮挡画布的非模态用法。
 * 被调用：资金节点详情；调用：Base UI Dialog、Button 与共享令牌。
 * 功能：侧边进出、标题、关闭和焦点管理；业务方控制内容与打开状态。
 * 预期结果：窄屏保持可操作，非模态打开不阻断图谱操作。
 */

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Button } from "@leonwillow-electron/ui/components/button";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { XIcon } from "lucide-react";
import type * as React from "react";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
	return (
		<SheetPrimitive.Backdrop
			data-slot="sheet-overlay"
			className={cn(
				"data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 z-50 bg-black/50 duration-200 data-closed:animate-out data-open:animate-in",
				className,
			)}
			{...props}
		/>
	);
}

function SheetContent({
	className,
	children,
	side = "right",
	showCloseButton = true,
	showOverlay = true,
	...props
}: SheetPrimitive.Popup.Props & {
	side?: "left" | "right";
	showCloseButton?: boolean;
	showOverlay?: boolean;
}) {
	return (
		<SheetPortal>
			{showOverlay && <SheetOverlay />}
			<SheetPrimitive.Popup
				data-slot="sheet-content"
				className={cn(
					"fixed z-50 flex h-full flex-col bg-background shadow-lg outline-none data-closed:animate-out data-open:animate-in data-closed:duration-200 data-open:duration-300",
					side === "right" &&
						"data-open:slide-in-from-right data-closed:slide-out-to-right inset-y-0 right-0 w-full border-l sm:max-w-sm",
					side === "left" &&
						"data-open:slide-in-from-left data-closed:slide-out-to-left inset-y-0 left-0 w-full border-r sm:max-w-sm",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<SheetPrimitive.Close
						data-slot="sheet-close"
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								className="absolute top-3 right-3 z-10"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">关闭</span>
					</SheetPrimitive.Close>
				)}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-1 p-4", className)}
			{...props}
		/>
	);
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("font-medium text-sm", className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: SheetPrimitive.Description.Props) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-muted-foreground text-xs", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetOverlay,
	SheetPortal,
	SheetTitle,
	SheetTrigger,
};
