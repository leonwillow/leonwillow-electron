/**
 * @file 可拖动并受视口约束的 Dialog 内容。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/theme-editor/theme-editor.tsx。
 * 调用：ui 基础组件/样式、ui/lib/utils、react、react-draggable。
 * 功能：合并拖动写入，测量窗口边界，支持方向键与 Shift 加速移动。
 * 预期结果：拖动不重渲染内容，窗口变小时面板仍可操作。
 */
import { DialogContent } from "@leonwillow-electron/ui/components/dialog";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	type ComponentProps,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { DraggableCore, type DraggableData } from "react-draggable";

type Position = { x: number; y: number };
type Bounds = { left: number; right: number; top: number; bottom: number };
const KEY_MOVEMENT: Record<string, Position> = {
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 },
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
};

// 手势沿用 react-draggable；瞬时坐标用 ref 保存，移动时不重新渲染 Dialog。
/**
 * 在 Dialog 上增加非模态拖动与方向键移动，位置始终限制在视口内。
 * @param props 沿用 DialogContent；标题拖动区需标记 data-floating-drag-handle。
 * @returns 无遮罩的浮动内容；坐标保存在 ref，以 rAF 合并 DOM 写入，不重渲染编辑内容。
 */
export function FloatingDialogContent({
	className,
	onKeyDown,
	...props
}: Omit<
	ComponentProps<typeof DialogContent>,
	"className" | "ref" | "style" | "showOverlay"
> & {
	className?: string;
}) {
	const nodeRef = useRef<HTMLDivElement>(null);
	const [popup, setPopup] = useState<HTMLDivElement | null>(null);
	const position = useRef<Position>({ x: 0, y: 0 });
	const boundsRef = useRef<Bounds>({
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
	});
	const initialized = useRef(false);
	const frame = useRef<number | null>(null);
	const dragStart = useRef<{ pointer: Position; position: Position } | null>(
		null,
	);
	const attach = useCallback((node: HTMLDivElement | null) => {
		nodeRef.current = node;
		setPopup(node);
	}, []);
	const clamp = useCallback(
		(next: Position) => ({
			x: Math.min(
				boundsRef.current.right,
				Math.max(boundsRef.current.left, next.x),
			),
			y: Math.min(
				boundsRef.current.bottom,
				Math.max(boundsRef.current.top, next.y),
			),
		}),
		[],
	);
	const paintPosition = useCallback(() => {
		frame.current = null;
		const node = nodeRef.current;
		if (node) {
			node.style.transform = `translate3d(${position.current.x}px, ${position.current.y}px, 0)`;
		}
	}, []);
	const flushPosition = useCallback(() => {
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		paintPosition();
	}, [paintPosition]);
	const moveTo = (next: Position) => {
		position.current = clamp(next);
		if (frame.current === null)
			frame.current = requestAnimationFrame(paintPosition);
	};
	const moveDrag = (data: DraggableData) => {
		const start = dragStart.current;
		if (!start) return;
		moveTo({
			x: start.position.x + data.x - start.pointer.x,
			y: start.position.y + data.y - start.pointer.y,
		});
	};

	useLayoutEffect(() => {
		if (!popup) return;
		const measure = () => {
			const gutter = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			const next = {
				left: gutter,
				top: gutter,
				right: Math.max(gutter, window.innerWidth - popup.offsetWidth - gutter),
				bottom: Math.max(
					gutter,
					window.innerHeight - popup.offsetHeight - gutter,
				),
			};
			boundsRef.current = next;
			position.current = clamp(
				initialized.current ? position.current : { x: next.right, y: next.top },
			);
			initialized.current = true;
			flushPosition();
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(popup);
		window.addEventListener("resize", measure);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", measure);
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = null;
		};
	}, [popup, flushPosition, clamp]);

	return (
		<DraggableCore
			nodeRef={nodeRef}
			handle="[data-floating-drag-handle]"
			cancel="button:not([data-floating-drag-handle])"
			onStart={(_, data) => {
				dragStart.current = {
					pointer: { x: data.x, y: data.y },
					position: position.current,
				};
			}}
			onDrag={(_, data) => moveDrag(data)}
			onStop={(_, data) => {
				moveDrag(data);
				flushPosition();
				dragStart.current = null;
			}}
		>
			<DialogContent
				{...props}
				ref={attach}
				showOverlay={false}
				data-slot="floating-dialog-content"
				className={cn(
					"top-0 left-0 flex h-[min(48rem,calc(100dvh-2rem))] w-[min(28rem,calc(100vw-2rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 shadow-lg transition-none will-change-transform data-closed:animate-none data-open:animate-none sm:max-w-none",
					className,
				)}
				onKeyDown={(event) => {
					onKeyDown?.(event);
					if (
						event.defaultPrevented ||
						!(event.target instanceof HTMLElement) ||
						!event.target.closest("button[data-floating-drag-handle]")
					)
						return;
					const direction = KEY_MOVEMENT[event.key];
					if (!direction) return;
					const step =
						Number.parseFloat(
							getComputedStyle(document.documentElement).fontSize,
						) * (event.shiftKey ? 5 : 1);
					event.preventDefault();
					event.stopPropagation();
					moveTo({
						x: position.current.x + direction.x * step,
						y: position.current.y + direction.y * step,
					});
				}}
			/>
		</DraggableCore>
	);
}
