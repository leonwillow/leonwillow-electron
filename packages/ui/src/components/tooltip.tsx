/**
 * @file 触发器的提示说明的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-05
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：布局图标、主题设置、资金图谱原生工具栏与分析操作。
 * 调用：@base-ui/react、ui/lib/utils。
 * 功能：支持外部 DOM 锚点、截断文字和 Portal 归属；锚点失效时关闭提示，悬停策略由调用方指定。
 * 预期结果：气泡只依附可见锚点，退场动画不漂移；保留父浮层与受控打开状态的协作。
 */
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	type ComponentPropsWithRef,
	createContext,
	type ReactElement,
	type ReactNode,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
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
const TooltipActionsContext = createContext<
	RefObject<TooltipPrimitive.Root.Actions | null> | undefined
>(undefined);

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

function Tooltip({
	actionsRef,
	onOpenChange,
	...props
}: TooltipPrimitive.Root.Props) {
	const actions = useRef<TooltipPrimitive.Root.Actions>(null);
	useImperativeHandle(actionsRef, () => ({
		close: () => actions.current?.close(),
		unmount: () => actions.current?.unmount(),
	}));
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
		<TooltipActionsContext.Provider value={actions}>
			<TooltipPrimitive.Root
				data-slot="tooltip"
				{...props}
				actionsRef={actions}
				disabled={disabled}
				onOpenChange={(next, details) => {
					onOpenChange?.(next, details);
					if (!details.isCanceled) setUncontrolledOpen(next);
				}}
			/>
		</TooltipActionsContext.Provider>
	);
}

/**
 * 使用定位器的隐藏状态关闭失效锚点；通过公共动作同步受控调用方及父层打开状态。
 * CSS 立即隐藏退场气泡，关闭延至下一帧，让快速重开时的旧定位结果有机会刷新。
 * 直接转发定位器的 ref 和 DOM 属性，保留 Base UI 的测量及事件处理。
 */
function TooltipPositionerGuard({
	open,
	anchorHidden,
	...props
}: ComponentPropsWithRef<"div"> &
	Pick<TooltipPrimitive.Positioner.State, "open" | "anchorHidden">) {
	const actions = useContext(TooltipActionsContext);
	useLayoutEffect(() => {
		if (!open || !anchorHidden) return;
		const frame = requestAnimationFrame(() => actions?.current?.close());
		return () => cancelAnimationFrame(frame);
	}, [open, anchorHidden, actions]);
	return <div {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/** 返回实际被省略的文字节点；链接中的图标和留白不作为提示锚点。 */
function truncatedText(root: HTMLElement | null) {
	const text = root?.querySelector<HTMLElement>(".truncate") ?? root;
	return text && text.clientWidth > 0 && text.scrollWidth > text.clientWidth
		? text
		: null;
}

/** 仅截断文字显示完整值；打开时测量，保持原文字或链接的 DOM 与交互。 */
function TooltipText({
	content,
	children,
}: {
	content?: string;
	children: ReactElement;
}) {
	const trigger = useRef<HTMLElement>(null);
	const [hint, setHint] = useState<{
		anchor: HTMLElement;
		content: string;
	} | null>(null);
	const open = !!content && hint?.content === content;
	useEffect(() => {
		if (!open || !hint) return;
		const measure = () => {
			if (!truncatedText(hint.anchor)) setHint(null);
		};
		// 只为当前打开的文字监听尺寸和字体变化，避免每个表格单元常驻观察器。
		const observer = new ResizeObserver(measure);
		observer.observe(hint.anchor);
		document.fonts.addEventListener("loadingdone", measure);
		return () => {
			observer.disconnect();
			document.fonts.removeEventListener("loadingdone", measure);
		};
	}, [open, hint]);
	if (!content) return children;
	return (
		<Tooltip
			open={open}
			onOpenChange={(next, details) => {
				if (!next) {
					setHint(null);
					return;
				}
				const anchor = truncatedText(trigger.current);
				if (!anchor) {
					details.cancel();
					return;
				}
				setHint({ anchor, content });
			}}
		>
			<TooltipTrigger
				ref={(element) => {
					trigger.current = element;
				}}
				render={children}
			/>
			<TooltipContent anchor={hint?.anchor} align="start" className="break-all">
				{content}
			</TooltipContent>
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
				className="isolate z-50 data-[anchor-hidden]:pointer-events-none data-[anchor-hidden]:invisible"
				render={(positionerProps, state) => (
					<TooltipPositionerGuard
						{...positionerProps}
						open={state.open}
						anchorHidden={state.anchorHidden}
					/>
				)}
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
