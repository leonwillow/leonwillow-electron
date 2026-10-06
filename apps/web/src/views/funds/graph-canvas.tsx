/**
 * @file Neo4j 查询结果的 G6 画布。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：绘制逐笔或有向汇总结果，平行边保持独立可展开 ID。
 * 被调用：analysis-panel；调用：按需加载的 G6、共享主题令牌。
 * 功能：节点交互与个人标记；G6 Toolbar 悬浮工具栏提供缩放并承载分析操作。
 * 预期结果：销毁旧实例，画布外提供同等可操作的账户/交易列表。
 */
import type { Graph, IPointerEvent } from "@antv/g6";
import {
	Tooltip,
	TooltipContent,
} from "@leonwillow-electron/ui/components/tooltip";
import {
	type ReactNode,
	type Ref,
	useEffect,
	useEffectEvent,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { accountName, formatFunds } from "@/lib/funds";
import type { AnalysisGraph } from "@/lib/funds-analysis";
import { fundsEdgeStyles } from "@/lib/funds-graph-layout";
import {
	lineDash,
	type NodePresentation,
	relatedEdgeMark,
} from "@/lib/funds-graph-presentation";
import type { CanvasSnapshot } from "@/lib/funds-view-history";
import {
	attachGraphToolbar,
	type GraphToolbarController,
	type GraphToolbarHint,
} from "./graph-toolbar-adapter";

export type GraphCanvasHandle = { capture: () => CanvasSnapshot | undefined };

export default function GraphCanvas({
	ref,
	toolbar,
	initialCanvas,
	viewKey,
	data,
	onDetails,
	onDrill,
	onNodeMenu,
	presentation,
	onTransaction,
}: {
	ref?: Ref<GraphCanvasHandle>;
	toolbar?: ReactNode;
	initialCanvas?: CanvasSnapshot;
	viewKey: number;
	data: AnalysisGraph;
	onDetails: (id: string) => void;
	onDrill: (id: string) => void;
	onNodeMenu: (id: string, x: number, y: number) => void;
	presentation: Record<string, NodePresentation>;
	onTransaction: (id: string) => void;
}) {
	const host = useRef<HTMLElement>(null);
	const [toolbarSlot] = useState(() => document.createElement("div"));
	const [ready, setReady] = useState(false);
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
	useEffect(() => {
		paintRef.current?.(presentation);
	}, [presentation]);
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
		};
		let resize: ResizeObserver | undefined;
		let observer: MutationObserver | undefined;
		const draw = async (revision: number) => {
			const { Graph } = await import("@antv/g6");
			if (disposed || revision !== drawRevision) return;
			const style = getComputedStyle(container);
			const root = getComputedStyle(document.documentElement);
			// Canvas 不继承 CSS 字体和颜色，显式从共享令牌取值，随主题重建。
			const color = (token: string) => style.getPropertyValue(token).trim();
			const unit = Number.parseFloat(root.fontSize);
			const edgeStyles = fundsEdgeStyles(
				data.edges,
				data.edges.some((t) => t.aggregated) ? 3 * unit : 4,
				3 * unit,
			);
			const graph = new Graph({
				container,
				autoResize: true,
				animation: false,
				autoFit: "view",
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
						labelFontSize: unit * 0.75,
						labelFontFamily: style.fontFamily,
						labelOffsetY: 8,
						cursor: "pointer",
					},
				},
				edge: {
					type: "quadratic",
					style: {
						endArrow: true,
						labelFontSize: unit * 0.625,
						labelBackground: true,
						labelBackgroundFill: color("--background"),
						cursor: "pointer",
					},
				},
				layout: {
					type: "circular",
					radius: Math.max(
						150,
						Math.min(container.clientWidth, container.clientHeight) * 0.32,
						// 全量节点按周长留出空间，避免所有节点仍挤在小图的固定半径上。
						(data.nodes.length * 2.5 * unit) / (2 * Math.PI),
					),
				},
				behaviors: [
					"drag-canvas",
					"zoom-canvas",
					"drag-element",
					"hover-activate",
				],
			});
			graphRef.current = graph;
			// 先初始化同一实例的空画布与原生插件，再绘制案件数据；不创建占位工具栏。
			await graph.draw();
			if (disposed || graph.destroyed || revision !== drawRevision) return;
			const controller = await attachGraphToolbar(
				graph,
				container,
				toolbarSlot,
				{ id: toolbarHintId, onChange: updateToolbarHint },
			);
			if (disposed || graph.destroyed || revision !== drawRevision) {
				controller?.destroy();
				return;
			}
			toolbarController = controller;
			// 给浏览器一帧显示完整的禁用工具栏，再开始大图绘制。
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
			if (disposed || graph.destroyed || revision !== drawRevision) return;
			graph.setData({
				nodes: data.nodes.map((a) => ({
					id: a.id,
					style: {
						labelText: `${accountName(a).length > 12 ? `${accountName(a).slice(0, 12)}…` : accountName(a)}\n${a.accountNumbers.length > 1 ? `${a.accountNumbers.length} 个账户` : a.number ? `尾号 ${a.number.slice(-4)}` : "账号待核"}`,
						fill: color(a.hasStatement ? "--primary" : "--background"),
						stroke: color(a.hasStatement ? "--primary" : "--muted-foreground"),
						lineDash: a.hasStatement ? undefined : [4, 3],
						labelFill: color("--foreground"),
					},
				})),
				edges: data.edges.map((t) => ({
					id: t.id,
					source: t.from,
					target: t.to,
					style: {
						...edgeStyles.get(t.id),
						labelText:
							data.edges.length <= 24
								? `${formatFunds(t.amountMinor, t.currency)}${t.aggregated ? ` · ${t.count} 笔` : ""}`
								: "",
						stroke: color("--muted-foreground"),
						labelFill: color("--foreground"),
					},
				})),
			});
			graph.on("node:click", (event: IPointerEvent) => {
				if (event.button !== 0 || !("id" in event.target)) return;
				cancelClick();
				const id = String(event.target.id);
				clickTimer = setTimeout(() => {
					if (!disposed) detailsEvent(id);
				}, 300);
			});
			graph.on("node:dblclick", (event: IPointerEvent) => {
				cancelClick();
				if ("id" in event.target) drillEvent(String(event.target.id));
			});
			graph.on("node:contextmenu", (event: IPointerEvent) => {
				cancelClick();
				event.preventDefault();
				if ("id" in event.target) {
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
				if ("id" in event.target) transactionEvent(String(event.target.id));
			});
			// 尺寸和粗细只放在 datum.style；G6 的全局 node/edge.style 优先级更高，会覆盖用户标记。
			const paint = (entries: Record<string, NodePresentation>) => {
				if (disposed || graph.destroyed) return;
				graph.updateNodeData(
					data.nodes.map((node) => {
						const entry = entries[node.id];
						const mark = entry?.marked ? entry.mark : undefined;
						return {
							id: node.id,
							type: mark?.shape ?? "circle",
							style: {
								size: (2 * unit * (mark?.size ?? 100)) / 100,
								radius: mark?.shape === "rect" ? unit * 0.3 : 0,
								fill:
									mark?.fill ??
									color(node.hasStatement ? "--primary" : "--background"),
								stroke:
									mark?.stroke ??
									color(node.hasStatement ? "--primary" : "--muted-foreground"),
								lineWidth: mark?.borderWidth ?? 1.5,
								lineDash: mark
									? lineDash(mark.borderDash)
									: node.hasStatement
										? []
										: [4, 3],
								visibility: entry?.hidden ? "hidden" : "visible",
							},
						};
					}),
				);
				graph.updateEdgeData(
					data.edges.map((edge) => {
						const mark = relatedEdgeMark(entries[edge.from], entries[edge.to]);
						return {
							id: edge.id,
							style: {
								stroke: mark?.edgeColor ?? color("--muted-foreground"),
								lineWidth: mark?.edgeWidth ?? 1,
								lineDash: mark ? lineDash(mark.edgeDash) : [],
								visibility:
									entries[edge.from]?.hidden || entries[edge.to]?.hidden
										? "hidden"
										: "visible",
							},
						};
					}),
				);
			};
			const initialPresentation = getPresentation();
			paint(initialPresentation);
			await graph.render();
			if (disposed || revision !== drawRevision) return;
			if (initialCanvas) {
				const ids = new Set(data.nodes.map((n) => n.id));
				graph.updateNodeData(
					initialCanvas.nodes
						.filter((n) => ids.has(n.id))
						.map(({ id, x, y }) => ({ id, style: { x, y } })),
				);
				await graph.draw();
				if (disposed || graph.destroyed || revision !== drawRevision) return;
				await graph.zoomTo(initialCanvas.zoom, false);
				if (disposed || graph.destroyed || revision !== drawRevision) return;
				// G6 getPosition/translateTo 在缩放后并非互逆；使用画布原点的视口坐标差恢复。
				const [x = 0, y = 0] = graph.getViewportByCanvas([0, 0]);
				await graph.translateBy(
					[initialCanvas.position[0] - x, initialCanvas.position[1] - y],
					false,
				);
			}
			if (disposed || graph.destroyed || revision !== drawRevision) return;
			readyRef.current = true;
			toolbarController?.setStatus("ready");
			setReady(true);
			paintRef.current = (entries) => {
				paint(entries);
				void graph.draw().catch(() => {
					if (!disposed) setError("标记绘制失败，请刷新画布后重试。");
				});
			};
			const latestPresentation = getPresentation();
			if (latestPresentation !== initialPresentation)
				paintRef.current(latestPresentation);
			resize = new ResizeObserver(() => {
				if (!disposed && !graph.destroyed) graph.resize();
			});
			resize.observe(container);
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
		observer = new MutationObserver(redraw);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => {
			disposed = true;
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
	}, [data, initialCanvas, viewKey, toolbarSlot, toolbarHintId]);
	useEffect(() => {
		if (!ready) return;
		toolbarFocus.current?.focus({ preventScroll: true });
		toolbarFocus.current = null;
	}, [ready]);
	return (
		<div className="relative rounded-lg border bg-background">
			{createPortal(
				<>
					<div className="funds-graph-toolbar-separator" aria-hidden="true" />
					<fieldset
						className="flex items-center gap-0.5"
						aria-label="图谱分析工具"
						disabled={!ready}
						inert={!ready}
					>
						{toolbar}
					</fieldset>
				</>,
				toolbarSlot,
			)}
			<Tooltip
				open={ready && toolbarHint.open}
				onOpenChange={(open) => {
					if (!open)
						setToolbarHint((previous) => ({ ...previous, open: false }));
				}}
			>
				<TooltipContent id={toolbarHintId} anchor={toolbarHint.data?.anchor}>
					{toolbarHint.data?.text}
				</TooltipContent>
			</Tooltip>
			<section
				ref={host}
				className="relative h-96 min-h-80 w-full lg:h-[30rem]"
				aria-label="资金关系图；单击查看详情，双击下钻，右键打开节点菜单；左侧列表提供键盘操作"
			/>
			{!data.nodes.length && !error && (
				<div
					className="pointer-events-none absolute inset-x-4 top-1/2 text-center text-muted-foreground text-sm"
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
	);
}
