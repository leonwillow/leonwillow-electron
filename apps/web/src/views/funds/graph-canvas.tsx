/**
 * @file Neo4j 查询结果的 G6 画布。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-09
 * 版本作用：绘制逐笔或有向汇总结果，平行边保持独立可展开 ID。
 * 被调用：analysis-panel；调用：按需加载的 G6、共享主题令牌。
 * 功能：节点交互与个人标记；G6 Toolbar 悬浮工具栏提供缩放并承载分析操作。
 * 预期结果：主题更新保留镜头与位置，分批绘制不锁住页面，切换视图取消旧任务。
 */
import type { Graph, IKeyboardEvent, IPointerEvent } from "@antv/g6";
import {
	Tooltip,
	TooltipContent,
	TooltipOpenScope,
} from "@leonwillow-electron/ui/components/tooltip";
import {
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useEffectEvent,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { AnalysisGraph, NodeMode } from "@/lib/funds-analysis";
import type { NodePresentation } from "@/lib/funds-graph-presentation";
import { toolbarPlacement } from "@/lib/funds-toolbar-layout";
import type { CanvasSnapshot } from "@/lib/funds-view-history";
import GraphBackgroundSettings, {
	canvasBackgroundProps,
} from "./graph-background-settings";
import { readCanvasSize, waitForCanvasSize } from "./graph-canvas-size";
import GraphHoverPreview, {
	type GraphHoverPreviewHandle,
} from "./graph-hover-preview";
import { createGraphPaintController } from "./graph-paint-controller";
import { createGraphRenderer, type GraphProgress } from "./graph-renderer";
import {
	attachGraphToolbar,
	type GraphToolbarController,
	type GraphToolbarHint,
} from "./graph-toolbar-adapter";
import { GraphToolbarContext } from "./graph-toolbar-context";
import type { ToolbarDockState } from "./graph-toolbar-dock";
import GraphToolbarSettings, {
	ToolbarFoldButton,
} from "./graph-toolbar-settings";
import { useCanvasBackground } from "./use-canvas-background";
import { useToolbarLayout } from "./use-toolbar-layout";

export type GraphCanvasHandle = { capture: () => CanvasSnapshot | undefined };

export default function GraphCanvas({
	ref,
	userId,
	toolbar,
	initialCanvas,
	viewKey,
	data,
	nodeMode,
	onDetails,
	onDrill,
	onNodeMenu,
	presentation,
	onTransaction,
}: {
	ref?: Ref<GraphCanvasHandle>;
	userId: string;
	toolbar?: ReactNode;
	initialCanvas?: CanvasSnapshot;
	viewKey: number;
	data: AnalysisGraph;
	nodeMode: NodeMode;
	onDetails: (id: string) => void;
	onDrill: (id: string) => void;
	onNodeMenu: (id: string, x: number, y: number) => void;
	presentation: Record<string, NodePresentation>;
	onTransaction: (id: string) => void;
}) {
	const host = useRef<HTMLElement>(null);
	const preview = useRef<GraphHoverPreviewHandle>(null);
	const [toolbarSlot] = useState(() => document.createElement("div"));
	const [toggleSlot] = useState(() => document.createElement("div"));
	const toolbarPreferences = useToolbarLayout(userId);
	const backgroundPreferences = useCanvasBackground(userId);
	const toolbarControllerRef = useRef<GraphToolbarController | null>(null);
	const popups = useRef(new Set<string>());
	const onPopupChange = useCallback((key: string, open: boolean) => {
		if (open) popups.current.add(key);
		else popups.current.delete(key);
		toolbarControllerRef.current?.dock.setHeld(popups.current.size > 0);
	}, []);
	const getToolbarLayout = useEffectEvent(() => toolbarPreferences.layout);
	useEffect(() => {
		toolbarControllerRef.current?.dock.update(toolbarPreferences.layout);
	}, [toolbarPreferences.layout]);
	const [ready, setReady] = useState(false);
	const [toolbarState, setToolbarState] = useState<ToolbarDockState>({
		expanded: false,
		moving: false,
	});
	const [progress, setProgress] = useState<GraphProgress>({
		nodes: 0,
		edges: 0,
	});
	const [toolbarHint, setToolbarHint] = useState<{
		data: GraphToolbarHint | null;
		open: boolean;
	}>({ data: null, open: false });
	const updateToolbarHint = useEffectEvent((hint: GraphToolbarHint | null) => {
		setToolbarHint((previous) => ({
			data: hint ?? previous.data,
			open: !!hint,
		}));
	});
	const toolbarHintId = useId();
	const toolbarFocus = useRef<HTMLElement | null>(null);
	const graphRef = useRef<Graph | null>(null);
	const readyRef = useRef(false);
	useImperativeHandle(
		ref,
		() => ({
			capture: () => {
				const graph = graphRef.current;
				if (!graph || graph.destroyed || !readyRef.current)
					return initialCanvas;
				const [x, y] = graph.getViewportByCanvas([0, 0]);
				return {
					zoom: graph.getZoom(),
					position: [x ?? 0, y ?? 0],
					nodes: graph.getNodeData().flatMap((n) => {
						const { x, y } = n.style ?? {};
						return typeof x === "number" && typeof y === "number"
							? [{ id: n.id, x, y }]
							: [];
					}),
				};
			},
		}),
		[initialCanvas],
	);
	const [error, setError] = useState("");
	const detailsEvent = useEffectEvent(onDetails);
	const drillEvent = useEffectEvent(onDrill);
	const menuEvent = useEffectEvent(onNodeMenu);
	const getPresentation = useEffectEvent(() => presentation);
	const paintRef = useRef<
		((entries: Record<string, NodePresentation>) => void) | null
	>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 背景色通过容器 CSS 供 renderer 读取，变化时只刷新样式，不重建画布。
	useEffect(() => {
		paintRef.current?.(presentation);
	}, [
		presentation,
		backgroundPreferences.background.tone,
		backgroundPreferences.background.customColor,
	]);
	const transactionEvent = useEffectEvent(onTransaction);
	useEffect(() => {
		const container = host.current;
		if (!container) return;
		setError("");
		// 同一批数据也可能切换历史帧；把帧号写入容器用于诊断当前绘制版本。
		container.dataset.viewKey = String(viewKey);
		const preventMenu = (event: MouseEvent) => event.preventDefault();
		container.addEventListener("contextmenu", preventMenu);
		let disposed = false;
		let drawRevision = 0;
		const lifetime = new AbortController();
		let themeFrame = 0;
		let progressTime = 0;
		setProgress({ nodes: 0, edges: 0 });
		let clickTimer: ReturnType<typeof setTimeout> | undefined;
		let menuFrame = 0;
		const cancelClick = () => clearTimeout(clickTimer);
		let toolbarController: GraphToolbarController | undefined;
		const detachToolbar = () => {
			const focused = document.activeElement;
			if (focused instanceof HTMLElement && toolbarSlot.contains(focused))
				toolbarFocus.current = focused;
			toolbarController?.destroy();
			toolbarController = undefined;
			toolbarControllerRef.current = null;
		};
		let resize: ResizeObserver | undefined;
		let observer: MutationObserver | undefined;
		const draw = async (revision: number) => {
			const { Graph, CanvasRenderer } = await import("./graph-runtime");
			const size = await waitForCanvasSize(container, lifetime.signal);
			if (!size) return;
			if (disposed || revision !== drawRevision) return;
			let renderer: ReturnType<typeof createGraphRenderer> | undefined;
			const graph = new Graph({
				transforms: [
					{
						type: "funds-node-style",
						nodeStyleOnly: () => renderer?.nodeStyleOnly() ?? false,
					},
				],
				container,
				width: size[0],
				height: size[1],
				renderer: () => new CanvasRenderer({ enableAutoRendering: false }),
				autoResize: false,
				animation: false,
				padding: [48, 48, 72, 48],
				plugins: [
					{
						type: "toolbar",
						key: "funds-toolbar",
						position: "bottom-left",
						className: "funds-graph-toolbar",
						style: { visibility: "hidden" },
						getItems: () => [
							{ id: "auto-fit", value: "fit", title: "适应画布" },
							{ id: "zoom-in", value: "zoom-in", title: "放大" },
							{ id: "zoom-out", value: "zoom-out", title: "缩小" },
						],
						onClick: (value: string, target: Element) => {
							if (
								!readyRef.current ||
								graph.destroyed ||
								target.getAttribute("aria-disabled") === "true"
							)
								return;
							const action =
								value === "fit"
									? graph.fitView(undefined, false)
									: graph.zoomBy(value === "zoom-in" ? 1.2 : 1 / 1.2, false);
							void action.catch(() => {
								if (!disposed && !graph.destroyed)
									setError("画布操作失败，请重试。");
							});
						},
					},
				],
				node: {
					style: {
						labelPlacement: "bottom",
						labelOffsetY: 8,
						cursor: "pointer",
					},
				},
				edge: {
					type: "quadratic",
					style: {
						labelBackground: true,
						cursor: "pointer",
					},
					state: {
						active: () => renderer?.edgeHoverStyle() ?? {},
					},
				},
				behaviors: [
					{
						type: "drag-canvas",
						// 加载保护须保留 G6 的空白目标限制，否则节点拖拽会同时平移镜头。
						enable: (event: IPointerEvent | IKeyboardEvent) =>
							readyRef.current &&
							(!("targetType" in event) || event.targetType === "canvas"),
					},
					...["zoom-canvas", "drag-element", "hover-activate"].map((type) => ({
						type,
						enable: () => readyRef.current,
					})),
				],
			});
			graphRef.current = graph;
			// 先初始化同一实例的空画布与原生插件，再绘制案件数据；不创建占位工具栏。
			await graph.draw();
			if (disposed || graph.destroyed || revision !== drawRevision) return;
			const paintController = createGraphPaintController(
				graph,
				container,
				lifetime.signal,
				() => setError("画布更新失败，请刷新后重试。"),
			);
			const controller = await attachGraphToolbar(
				graph,
				container,
				toolbarSlot,
				toggleSlot,
				getToolbarLayout(),
				{ id: toolbarHintId, onChange: updateToolbarHint },
				setToolbarState,
			);
			if (disposed || graph.destroyed || revision !== drawRevision) {
				controller?.destroy();
				return;
			}
			toolbarController = controller;
			toolbarControllerRef.current = controller ?? null;
			controller?.dock.setHeld(popups.current.size > 0);
			// 给浏览器一帧显示完整的禁用工具栏，再开始大图绘制。
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
			if (disposed || graph.destroyed || revision !== drawRevision) return;
			for (const kind of ["node", "edge"] as const) {
				graph.on(`${kind}:pointerenter`, (event: IPointerEvent) => {
					if (readyRef.current && "id" in event.target)
						preview.current?.show({ kind, id: String(event.target.id) });
				});
			}
			graph.on("node:click", (event: IPointerEvent) => {
				if (!readyRef.current || event.button !== 0 || !("id" in event.target))
					return;
				cancelClick();
				const id = String(event.target.id);
				clickTimer = setTimeout(() => {
					if (!disposed) detailsEvent(id);
				}, 300);
			});
			graph.on("node:dblclick", (event: IPointerEvent) => {
				cancelClick();
				if (readyRef.current && "id" in event.target)
					drillEvent(String(event.target.id));
			});
			graph.on("node:contextmenu", (event: IPointerEvent) => {
				cancelClick();
				event.preventDefault();
				if (readyRef.current && "id" in event.target) {
					const id = String(event.target.id);
					const { x, y } = event.client;
					// G6 在 pointerdown 合成 contextmenu；等本次事件结束再打开，避免被菜单的外部点击监听立即关闭。
					cancelAnimationFrame(menuFrame);
					menuFrame = requestAnimationFrame(() => {
						if (!disposed) menuEvent(id, x, y);
					});
				}
			});
			graph.on("node:dragstart", cancelClick);
			graph.on("edge:click", (event: IPointerEvent) => {
				if (!readyRef.current || event.button !== 0 || !("id" in event.target))
					return;
				// 节点单击等待双击判定；随后点线时必须取消旧选择，避免详情跳回节点。
				cancelClick();
				transactionEvent(String(event.target.id));
			});
			renderer = createGraphRenderer({
				graph,
				paintController,
				container,
				data,
				presentation: getPresentation(),
				snapshot: initialCanvas,
				signal: lifetime.signal,
				onProgress: (value) => {
					if (disposed) return;
					if (
						performance.now() - progressTime >= 80 ||
						value.edges === data.edges.length
					) {
						progressTime = performance.now();
						setProgress(value);
					}
				},
				onError: () => setError("样式更新失败，请刷新画布后重试。"),
			});
			paintRef.current = renderer.update;
			graph.on("aftertransform", () => {
				if (readyRef.current) renderer?.update(getPresentation());
			});
			resize = new ResizeObserver(() => {
				// 隐藏的页签仍保留实例，不能把零尺寸写进 G6 镜头。
				const next = readCanvasSize(container);
				if (disposed || graph.destroyed || !next) return;
				const current = graph.getSize();
				if (next[0] !== current[0] || next[1] !== current[1])
					graph.resize(next[0], next[1]);
			});
			resize.observe(container);
			const loaded = await renderer.load();
			if (!loaded || disposed || revision !== drawRevision) return;
			readyRef.current = true;
			toolbarController?.setStatus("ready");
			setReady(true);
			renderer.update(getPresentation());
		};
		const redraw = () => {
			cancelClick();
			cancelAnimationFrame(menuFrame);
			paintRef.current = null;
			const revision = ++drawRevision;
			resize?.disconnect();
			readyRef.current = false;
			setReady(false);
			detachToolbar();
			graphRef.current?.destroy();
			graphRef.current = null;
			void draw(revision).catch(() => {
				if (!disposed && revision === drawRevision) {
					toolbarController?.setStatus("error");
					setError("图形暂时无法绘制，请使用交易明细或刷新页面。");
				}
			});
		};
		redraw();
		observer = new MutationObserver(() => {
			cancelAnimationFrame(themeFrame);
			themeFrame = requestAnimationFrame(() => {
				if (!disposed) paintRef.current?.(getPresentation());
			});
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => {
			disposed = true;
			lifetime.abort();
			cancelAnimationFrame(themeFrame);
			container.removeEventListener("contextmenu", preventMenu);
			cancelClick();
			cancelAnimationFrame(menuFrame);
			paintRef.current = null;
			resize?.disconnect();
			observer?.disconnect();
			readyRef.current = false;
			detachToolbar();
			graphRef.current?.destroy();
			graphRef.current = null;
		};
	}, [data, initialCanvas, viewKey, toolbarSlot, toolbarHintId, toggleSlot]);
	useEffect(() => {
		if (!ready) return;
		toolbarFocus.current?.focus({ preventScroll: true });
		toolbarFocus.current = null;
	}, [ready]);
	return (
		<GraphToolbarContext
			value={{
				side: toolbarPlacement(toolbarPreferences.layout).side,
				onPopupChange,
			}}
		>
			<div
				{...canvasBackgroundProps(backgroundPreferences.background)}
				className="funds-canvas-surface relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border"
			>
				<TooltipOpenScope
					onOpenChange={onPopupChange}
					disabled={toolbarState.moving}
				>
					{createPortal(
						<ToolbarFoldButton
							layout={toolbarPreferences.layout}
							dockState={toolbarState}
							disabled={!ready}
							onChange={toolbarPreferences.save}
						/>,
						toggleSlot,
					)}
					{createPortal(
						<>
							<div
								className="funds-graph-toolbar-separator"
								aria-hidden="true"
							/>
							<fieldset
								className="funds-graph-toolbar-tools flex items-center gap-0.5"
								aria-label="图谱分析工具"
								disabled={!ready}
								inert={!ready}
							>
								{toolbar}
								<div
									className="funds-graph-toolbar-separator"
									aria-hidden="true"
								/>
								<GraphBackgroundSettings
									background={backgroundPreferences.background}
									onChange={backgroundPreferences.save}
									error={backgroundPreferences.error}
								/>
								<GraphToolbarSettings
									layout={toolbarPreferences.layout}
									onChange={toolbarPreferences.save}
									error={toolbarPreferences.error}
								/>
							</fieldset>
						</>,
						toolbarSlot,
					)}
					<Tooltip
						open={ready && toolbarHint.open}
						onOpenChange={(open) => {
							if (!open) toolbarControllerRef.current?.hint.close();
						}}
					>
						<TooltipContent
							id={toolbarHintId}
							anchor={toolbarHint.data?.anchor}
							onPointerEnter={() => toolbarControllerRef.current?.hint.enter()}
							onPointerLeave={() => toolbarControllerRef.current?.hint.leave()}
							side={toolbarPlacement(toolbarPreferences.layout).side}
						>
							{toolbarHint.data?.text}
						</TooltipContent>
					</Tooltip>
				</TooltipOpenScope>
				<section
					ref={host}
					aria-busy={!ready && !error}
					className="relative h-full min-h-0 w-full"
					aria-label="资金关系图；单击查看详情，双击下钻，右键打开节点菜单；左侧列表提供键盘操作"
				/>
				<GraphHoverPreview
					ref={preview}
					userId={userId}
					data={data}
					mode={nodeMode}
					presentation={presentation}
					ready={ready}
					error={error}
				/>
				{backgroundPreferences.error && (
					<p
						role="alert"
						className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md bg-background p-2 text-destructive text-xs"
					>
						{backgroundPreferences.error}
					</p>
				)}
				{toolbarPreferences.error && (
					<p
						role="alert"
						className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md bg-background p-2 text-destructive text-xs"
					>
						{toolbarPreferences.error}
					</p>
				)}
				{!ready && !error && data.nodes.length > 0 && (
					<div
						className="pointer-events-none absolute top-3 right-3 max-w-[calc(100%-1.5rem)] rounded-md border bg-background/95 px-3 py-2 text-muted-foreground text-xs tabular-nums"
						role="progressbar"
						aria-label="绘制图谱"
						aria-valuemin={0}
						aria-valuemax={data.nodes.length + data.edges.length}
						aria-valuenow={progress.nodes + progress.edges}
					>
						节点 {progress.nodes.toLocaleString()} /{" "}
						{data.nodes.length.toLocaleString()} · 连线{" "}
						{progress.edges.toLocaleString()} /{" "}
						{data.edges.length.toLocaleString()}
					</div>
				)}
				{!data.nodes.length && !error && (
					<div
						className="pointer-events-none absolute inset-x-4 top-1/2 rounded-md bg-background p-2 text-center text-foreground text-sm"
						role="status"
					>
						没有符合条件的节点或连线，可调整筛选或返回上一步。
					</div>
				)}
				{error && (
					<p
						role="alert"
						className="absolute top-4 left-4 bg-background p-2 text-destructive text-xs"
					>
						{error}
					</p>
				)}
			</div>
		</GraphToolbarContext>
	);
}
