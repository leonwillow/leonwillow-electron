/**
 * @file 触发器的提示说明的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-07
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：布局图标、主题设置、资金图谱原生工具栏与分析操作。
 * 调用：@base-ui/react、ui/lib/utils。
 * 功能：支持外部 DOM 锚点；悬停容器内可限定 Portal 归属，避免移入气泡误关父层。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	createContext,
	type ReactElement,
	type ReactNode,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

const TooltipPortalContext = createContext<
	RefObject<HTMLDivElement | null> | undefined
>(undefined);

const TooltipOpenContext = createContext<
	((id: string, open: boolean) => void) | undefined
>(undefined);
const TooltipDisabledContext = createContext(false);

/** 自动收起的父容器借此识别其 Portal 气泡；不改变全局提示的打开策略。 */
function TooltipOpenScope({
	children,
	onOpenChange,
	disabled = false,
}: {
	children: ReactNode;
	onOpenChange: (id: string, open: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<TooltipOpenContext.Provider value={onOpenChange}>
			<TooltipDisabledContext.Provider value={disabled}>
				{children}
			</TooltipDisabledContext.Provider>
		</TooltipOpenContext.Provider>
	);
}

/** 放在父浮层的非滚动区域，保持提示为其 DOM 后代且不受正文滚动裁剪。 */
function TooltipPortalScope({ children }: { children: ReactNode }) {
	const container = useRef<HTMLDivElement>(null);
	return (
		<TooltipPortalContext.Provider value={container}>
			{children}
			<div ref={container} data-slot="tooltip-portal-container" />
		</TooltipPortalContext.Provider>
	);
}

function TooltipProvider({
	delay = 0,
	...props
}: TooltipPrimitive.Provider.Props) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delay={delay}
			{...props}
		/>
	);
}

function Tooltip({ onOpenChange, ...props }: TooltipPrimitive.Root.Props) {
	const notify = useContext(TooltipOpenContext);
	const scopeDisabled = useContext(TooltipDisabledContext);
	const disabled = props.disabled || scopeDisabled;
	const id = useId();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(
		props.defaultOpen ?? false,
	);
	const open = !disabled && (props.open ?? uncontrolledOpen);
	useEffect(() => {
		notify?.(id, open);
		return () => notify?.(id, false);
	}, [notify, id, open]);
	return (
		<TooltipPrimitive.Root
			data-slot="tooltip"
			{...props}
			disabled={disabled}
			disableHoverablePopup={false}
			onOpenChange={(next, details) => {
				onOpenChange?.(next, details);
				if (!details.isCanceled) setUncontrolledOpen(next);
			}}
		/>
	);
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/** 替代浏览器 title 提示，复用原文字或链接节点，不增加布局包装元素。 */
function TooltipText({
	content,
	children,
}: {
	content?: string;
	children: ReactElement;
}) {
	if (!content) return children;
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent className="break-all">{content}</TooltipContent>
		</Tooltip>
	);
}

function TooltipContent({
	className,
	side = "top",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	anchor,
	children,
	...props
}: TooltipPrimitive.Popup.Props &
	Pick<
		TooltipPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset" | "anchor"
	>) {
	const container = useContext(TooltipPortalContext);
	return (
		<TooltipPrimitive.Portal container={container}>
			<TooltipPrimitive.Positioner
				anchor={anchor}
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-50"
			>
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-background text-xs has-data-[slot=kbd]:pr-1.5 data-[state=delayed-open]:animate-in data-closed:animate-out data-open:animate-in **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
						className,
					)}
					{...props}
				>
					{children}
					<TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-start]:top-1/2! data-[side=left]:top-1/2! data-[side=right]:top-1/2! data-[side=inline-start]:-right-1 data-[side=left]:-right-1 data-[side=top]:-bottom-2.5 data-[side=inline-end]:-left-1 data-[side=right]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:-translate-y-1/2 data-[side=right]:-translate-y-1/2" />
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export {
	Tooltip,
	TooltipContent,
	TooltipOpenScope,
	TooltipPortalScope,
	TooltipProvider,
	TooltipText,
	TooltipTrigger,
};
