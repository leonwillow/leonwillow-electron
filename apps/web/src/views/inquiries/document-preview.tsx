/**
 * @file 笔录文书的适宽缩放、固定工具栏和拖拽浏览容器。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：可视区域决定自动比例，纸张只接收比例，避免内容反向撑大测量宽度。
 * 被调用：InquiryRecordEditor；调用：InquiryDocumentPages、ScrollArea、InquiryIconButton。
 * 预期结果：面板双向适宽，手动缩放保持视野，拖动不触发字段定位；打印不受影响。
 */
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import {
	type PointerEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { InquiryDocument } from "@/lib/inquiries";
import { InquiryIconButton } from "./controls";
import InquiryDocumentPages, { INQUIRY_PAGE_WIDTH } from "./document-pages";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.1;
const DRAG_THRESHOLD = 5;
const clampScale = (value: number) =>
	Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

type PanGesture = {
	pointerId: number;
	x: number;
	y: number;
	left: number;
	top: number;
	dragged: boolean;
};

export default function InquiryDocumentPreview({
	draft,
	focus,
}: {
	draft: InquiryDocument;
	focus: (id: string) => void;
}) {
	const viewport = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const pan = useRef<PanGesture | null>(null);
	const suppressClick = useRef(false);
	const zoomAnchor = useRef<{ x: number; y: number } | null>(null);
	const [fitScale, setFitScale] = useState(MIN_SCALE);
	const [manualScale, setManualScale] = useState<number | null>(null);
	const [dragging, setDragging] = useState(false);
	const scale = manualScale ?? fitScale;

	useEffect(() => {
		const view = viewport.current;
		const inner = content.current;
		if (!view || !inner) return;
		const resize = () => {
			const style = getComputedStyle(inner);
			const available =
				view.clientWidth -
				Number.parseFloat(style.paddingLeft) -
				Number.parseFloat(style.paddingRight);
			// 折叠时的零宽度不覆盖上次比例；展开后重新读取真实 viewport。
			if (available > 0)
				setFitScale(clampScale(available / INQUIRY_PAGE_WIDTH));
		};
		const observer = new ResizeObserver(resize);
		observer.observe(view);
		// 内容宽度强制约束于 viewport；同时观察它以响应全局 rem 间距变化。
		observer.observe(inner);
		resize();
		return () => observer.disconnect();
	}, []);

	useLayoutEffect(() => {
		const view = viewport.current;
		const anchor = zoomAnchor.current;
		if (!view || !anchor) return;
		view.scrollLeft = anchor.x * scale - view.clientWidth / 2;
		view.scrollTop = anchor.y * scale - view.clientHeight / 2;
		zoomAnchor.current = null;
	}, [scale]);

	function zoom(delta: number) {
		const next = clampScale(Math.round((scale + delta) * 100) / 100);
		if (next === scale) return;
		const view = viewport.current;
		if (view) {
			zoomAnchor.current = {
				x: (view.scrollLeft + view.clientWidth / 2) / scale,
				y: (view.scrollTop + view.clientHeight / 2) / scale,
			};
		}
		setManualScale(next);
	}

	/** 仅主鼠标键拖动；触屏保留 ScrollArea 原生手势。越过阈值后才捕获，保留普通字段点击。 */
	function startPan(event: PointerEvent<HTMLDivElement>) {
		suppressClick.current = false;
		if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary)
			return;
		pan.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left: event.currentTarget.scrollLeft,
			top: event.currentTarget.scrollTop,
			dragged: false,
		};
	}

	function movePan(event: PointerEvent<HTMLDivElement>) {
		const gesture = pan.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return;
		if (!(event.buttons & 1)) {
			endPan(event);
			return;
		}
		const dx = event.clientX - gesture.x;
		const dy = event.clientY - gesture.y;
		if (!gesture.dragged) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			gesture.dragged = true;
			suppressClick.current = true;
			event.currentTarget.setPointerCapture(event.pointerId);
			event.currentTarget.focus({ preventScroll: true });
			setDragging(true);
		}
		event.preventDefault();
		event.currentTarget.scrollLeft = gesture.left - dx;
		event.currentTarget.scrollTop = gesture.top - dy;
	}

	function endPan(event: PointerEvent<HTMLDivElement>) {
		if (pan.current?.pointerId !== event.pointerId) return;
		pan.current = null;
		setDragging(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}

	return (
		<div
			className="inquiry-document-preview"
			data-dragging={dragging || undefined}
		>
			<ScrollArea
				className="min-h-0 min-w-0 flex-1"
				contentClassName="inquiry-document-preview-content min-w-0!"
				contentRender={<div ref={content} />}
				viewportProps={{
					ref: viewport,
					className: "inquiry-document-preview-viewport",
					"aria-label": "文书预览滚动区域",
					tabIndex: 0,
					onPointerDown: startPan,
					onPointerMove: movePan,
					onPointerUp: endPan,
					onPointerCancel: endPan,
					onLostPointerCapture: endPan,
					onPointerLeave: (event) => {
						if (!pan.current?.dragged) endPan(event);
					},
					onDragStart: (event) => event.preventDefault(),
					onClickCapture: (event) => {
						if (!suppressClick.current || event.detail === 0) return;
						event.preventDefault();
						event.stopPropagation();
						suppressClick.current = false;
					},
				}}
			>
				<InquiryDocumentPages draft={draft} scale={scale} focus={focus} />
			</ScrollArea>
			<div
				className="inquiry-document-preview-toolbar"
				role="toolbar"
				aria-label="文书预览工具栏"
			>
				<InquiryIconButton
					label="缩小文书"
					size="icon-sm"
					disabled={scale <= MIN_SCALE}
					disabledReason="已缩小至 10%"
					onClick={() => zoom(-ZOOM_STEP)}
				>
					<MinusIcon />
				</InquiryIconButton>
				<output
					className="inquiry-document-preview-scale text-xs tabular-nums"
					aria-label="预览缩放比例"
				>
					{Math.round(scale * 100)}%
				</output>
				<InquiryIconButton
					label="放大文书"
					size="icon-sm"
					disabled={scale >= MAX_SCALE}
					disabledReason="已放大至 300%"
					onClick={() => zoom(ZOOM_STEP)}
				>
					<PlusIcon />
				</InquiryIconButton>
				<InquiryIconButton
					label="还原为自动适宽"
					size="icon-sm"
					onClick={() => {
						zoomAnchor.current = null;
						setManualScale(null);
						viewport.current?.scrollTo({
							left: 0,
							top: 0,
							behavior: "instant",
						});
					}}
				>
					<RotateCcwIcon />
				</InquiryIconButton>
			</div>
		</div>
	);
}
