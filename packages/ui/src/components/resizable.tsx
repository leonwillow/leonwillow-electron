/**
 * @file ReUI 的可调整分栏组合。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：透传官方 Group、Panel 和 Separator 的尺寸、鼠标及键盘行为。
 * 被调用：工作台共享分栏；调用：react-resizable-panels、共享 cn。
 * 预期结果：分隔条使用语义色和可见焦点，布局及尺寸状态由调用方组织。
 */
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "../lib/utils";

function ResizablePanelGroup({
	className,
	...props
}: ResizablePrimitive.GroupProps) {
	return (
		<ResizablePrimitive.Group
			data-slot="resizable-panel-group"
			className={cn(
				"flex h-full w-full aria-[orientation=vertical]:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
	withHandle,
	className,
	...props
}: ResizablePrimitive.SeparatorProps & {
	withHandle?: boolean;
}) {
	return (
		<ResizablePrimitive.Separator
			data-slot="resizable-handle"
			className={cn(
				"relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
				className,
			)}
			{...props}
		>
			{withHandle && (
				<div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
			)}
		</ResizablePrimitive.Separator>
	);
}

export type { PanelImperativeHandle } from "react-resizable-panels";
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
