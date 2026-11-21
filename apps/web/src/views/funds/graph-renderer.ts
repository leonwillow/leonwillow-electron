/**
 * @file G6 图元分批绘制与原位样式更新。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-21
 * 版本作用：布局坐标只在进入视图时计算，主题和标记不触发布局或自动缩放。
 * 被调用：graph-canvas；调用：G6 draw/addData、共享主题令牌、分批调度与画面提交器。
 * 预期结果：完整绘制全部节点/边，加载过程可取消，主题与局部标记增量更新且无微任务锁死。
 */
import type { EdgeData, Graph, NodeData } from "@antv/g6";
import { accountName, formatFunds } from "@/lib/funds-money";
import type { GraphPaintController } from "./graph-paint-controller";
import type { AnalysisGraph } from "./model/analysis";
import { canvasGraphPalette } from "./model/canvas-background";
import { drawInBatches } from "./model/graph-batches";
import { fundsEdgeStyles, fundsNodePositions } from "./model/graph-layout";
import {
	type GraphPresentation,
	lineDash,
	type NodePresentation,
	relatedEdgeMark,
} from "./model/graph-presentation";
import type { CanvasSnapshot } from "./model/view-history";

export type GraphProgress = { nodes: number; edges: number };

function sameNodePresentation(a?: NodePresentation, b?: NodePresentation) {
	if (a === b) return true;
	return (
		Boolean(a?.hidden) === Boolean(b?.hidden) &&
		Boolean(a?.marked) === Boolean(b?.marked) &&
		(a?.updatedAt ?? 0) === (b?.updatedAt ?? 0) &&
		a?.mark === b?.mark
	);
}

function readTheme(container: HTMLElement, graph: Graph, data: AnalysisGraph) {
	const style = getComputedStyle(container);
	return {
		unit: Number.parseFloat(
			getComputedStyle(document.documentElement).fontSize,
		),
		font: style.fontFamily,
		labels: data.nodes.length < 200 || graph.getZoom() >= 0.15,
		arrows: data.edges.length < 500 || graph.getZoom() >= 0.12,
		...canvasGraphPalette({
			primary: style.getPropertyValue("--primary").trim(),
			background:
				style.getPropertyValue("--funds-canvas-background").trim() ||
				style.getPropertyValue("--background").trim(),
			foreground: style.getPropertyValue("--foreground").trim(),
			muted: style.getPropertyValue("--muted-foreground").trim(),
		}),
	};
}
type GraphTheme = ReturnType<typeof readTheme>;

function nodePatch(
	node: AnalysisGraph["nodes"][number],
	entries: GraphPresentation,
	theme: GraphTheme,
): NodeData {
	const entry = entries[node.id];
	const mark = entry?.marked ? entry.mark : undefined;
	return {
		id: node.id,
		type: mark?.shape ?? "circle",
		style: {
			size: (2 * theme.unit * (mark?.size ?? 100)) / 100,
			radius: mark?.shape === "rect" ? theme.unit * 0.3 : 0,
			fill:
				mark?.fill ?? (node.hasStatement ? theme.primary : theme.background),
			stroke: mark?.stroke ?? (node.hasStatement ? theme.primary : theme.muted),
			lineWidth: mark?.borderWidth ?? 1.5,
			lineDash: mark
				? lineDash(mark.borderDash)
				: node.hasStatement
					? []
					: [4, 3],
			visibility: entry?.hidden ? "hidden" : "visible",
			label: theme.labels,
			labelFontSize: theme.unit * 0.8125,
			labelFontFamily: theme.font,
			labelFill: theme.foreground,
		},
	};
}

function edgePatch(
	edge: AnalysisGraph["edges"][number],
	entries: GraphPresentation,
	theme: GraphTheme,
): EdgeData & { id: string } {
	const mark = relatedEdgeMark(entries[edge.from], entries[edge.to]);
	return {
		id: edge.id,
		source: edge.from,
		target: edge.to,
		style: {
			endArrow: theme.arrows,
			stroke: mark?.edgeColor ?? theme.muted,
			lineWidth: mark?.edgeWidth ?? 1,
			lineDash: mark ? lineDash(mark.edgeDash) : [],
			visibility:
				entries[edge.from]?.hidden || entries[edge.to]?.hidden
					? "hidden"
					: "visible",
			labelFill: theme.foreground,
			labelFontFamily: theme.font,
			labelFontSize: theme.unit * 0.72,
			labelBackgroundFill: theme.background,
		},
	};
}

/** graph 由调用方拥有；signal 取消后不再写入。load 失败抛出，后续更新失败走 onError。 */
export function createGraphRenderer({
	graph,
	container,
	data,
	presentation,
	snapshot,
	signal,
	onProgress,
	onError,
	paintController,
}: {
	graph: Graph;
	container: HTMLElement;
	data: AnalysisGraph;
	presentation: GraphPresentation;
	snapshot?: CanvasSnapshot;
	signal: AbortSignal;
	onProgress: (progress: GraphProgress) => void;
	onError: () => void;
	paintController: GraphPaintController;
}) {
	let theme = readTheme(container, graph, data);
	let themeKey = JSON.stringify(theme);
	let entries = presentation;
	let version = 0;
	let applied = 0;
	let loaded = false;
	let painting: Promise<void> | undefined;
	let paintAbort = new AbortController();
	let dirtyAll = false;
	const dirtyNodes = new Set<string>();
	const nodesPainted = new Map<string, string>();
	const edgesPainted = new Map<string, string>();
	const active = () => !signal.aborted && !graph.destroyed;
	let nodeStyleOnly = false;
	const nodeGeometry = new Map<string, string>();
	const pendingEdges = new Set<string>();
	const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
	const edgeById = new Map(data.edges.map((edge) => [edge.id, edge]));
	const adjacent = new Map<string, Set<string>>();
	for (const edge of data.edges) {
		for (const id of [edge.from, edge.to]) {
			const edges = adjacent.get(id) ?? new Set<string>();
			edges.add(edge.id);
			adjacent.set(id, edges);
		}
	}
	const geometryKey = (node: NodeData) =>
		JSON.stringify([
			node.type,
			node.style?.size,
			node.style?.radius,
			node.style?.lineWidth,
		]);

	const flush = () => {
		if (painting) return painting;
		let settled = false;
		const run = (async () => {
			let finished = false;
			try {
				while (active() && applied !== version) {
					const current = version;
					const paintTheme = theme;
					const paintEntries = entries;
					const fullScan = dirtyAll;
					paintAbort = new AbortController();
					const paintSignal = AbortSignal.any([signal, paintAbort.signal]);
					const candidateNodes = fullScan
						? data.nodes
						: [...dirtyNodes].flatMap((id) => {
								const node = nodeById.get(id);
								return node ? [node] : [];
							});
					const nodes: { patch: NodeData; key: string }[] = [];
					for (const node of candidateNodes) {
						const patch = nodePatch(node, paintEntries, paintTheme);
						const key = JSON.stringify(patch);
						if (nodesPainted.get(patch.id) !== key) nodes.push({ patch, key });
					}
					await drawInBatches(
						nodes,
						async (batch) => {
							nodeStyleOnly = true;
							const patches = batch.map((item) => item.patch);
							for (const patch of patches) {
								if (nodeGeometry.get(patch.id) !== geometryKey(patch)) {
									for (const id of adjacent.get(patch.id) ?? [])
										pendingEdges.add(id);
								}
							}
							try {
								graph.updateNodeData(patches);
								await graph.draw();
								for (const patch of patches)
									nodeGeometry.set(patch.id, geometryKey(patch));
							} finally {
								nodeStyleOnly = false;
							}
							for (const item of batch)
								nodesPainted.set(item.patch.id, item.key);
						},
						paintSignal,
					);
					// 尺寸/形状变化涉及的连线也按批更新；取消重绘后仍保留待更新 ID。
					let candidateEdges: AnalysisGraph["edges"];
					if (fullScan) {
						candidateEdges = data.edges;
					} else {
						const edgeIds = new Set<string>(pendingEdges);
						for (const nodeId of dirtyNodes) {
							for (const edgeId of adjacent.get(nodeId) ?? [])
								edgeIds.add(edgeId);
						}
						candidateEdges = [...edgeIds].flatMap((id) => {
							const edge = edgeById.get(id);
							return edge ? [edge] : [];
						});
					}
					const edges: { patch: EdgeData & { id: string }; key: string }[] = [];
					for (const edge of candidateEdges) {
						const patch = edgePatch(edge, paintEntries, paintTheme);
						const key = JSON.stringify(patch);
						if (
							pendingEdges.has(patch.id) ||
							edgesPainted.get(patch.id) !== key
						)
							edges.push({ patch, key });
					}
					await drawInBatches(
						edges,
						async (batch) => {
							graph.updateEdgeData(batch.map((item) => item.patch));
							await graph.draw();
							for (const item of batch) {
								edgesPainted.set(item.patch.id, item.key);
								pendingEdges.delete(item.patch.id);
							}
						},
						paintSignal,
					);
					if (!paintSignal.aborted) {
						applied = current;
						if (version === current) {
							dirtyAll = false;
							dirtyNodes.clear();
						}
					}
				}
				finished = active() && applied === version;
			} catch (error: unknown) {
				settled = true;
				painting = undefined;
				paintController.cancel();
				throw error;
			}
			settled = true;
			painting = undefined;
			if (finished) paintController.finish();
			else paintController.cancel();
		})();
		if (!settled) painting = run;
		return run;
	};

	return {
		nodeStyleOnly: () => nodeStyleOnly,
		// 悬停只覆盖线色，不写回标记；箭头继承线色，移开由 G6 恢复原样式。
		edgeHoverStyle: () => ({ stroke: theme.primary }),
		/** 忽略与画布无关的根样式变更；绘制期间只记录最新版，所有 G6 写入串行执行。 */
		update(next: GraphPresentation) {
			if (!active()) return;
			const nextTheme = readTheme(container, graph, data);
			const nextThemeKey = JSON.stringify(nextTheme);
			const themeChanged = nextThemeKey !== themeKey;
			const changedNodes: string[] = [];
			if (entries !== next) {
				for (const node of data.nodes) {
					if (!sameNodePresentation(entries[node.id], next[node.id]))
						changedNodes.push(node.id);
				}
			}
			if (!themeChanged && changedNodes.length === 0) return;
			if (themeChanged) {
				dirtyAll = true;
			} else {
				for (const id of changedNodes) dirtyNodes.add(id);
			}
			// 仅配色变更可保留旧画面；字体、尺寸、可见性与缩放细节立即走正常绘制。
			if (
				loaded &&
				changedNodes.length === 0 &&
				theme.unit === nextTheme.unit &&
				theme.font === nextTheme.font &&
				theme.labels === nextTheme.labels &&
				theme.arrows === nextTheme.arrows
			) {
				paintController.begin(theme.background, theme.foreground);
			} else {
				paintController.cancel();
			}
			entries = next;
			theme = nextTheme;
			themeKey = nextThemeKey;
			version += 1;
			paintAbort.abort();
			if (loaded)
				void flush().catch(() => {
					if (active()) onError();
				});
		},
		async load() {
			let initialTheme = theme;
			const unit = initialTheme.unit;
			// 分批绘制途中可能切到流水页签；沿用初始化时的有效尺寸。
			const [width, height] = graph.getSize();
			const radius = Math.max(
				150,
				Math.min(width, height) * 0.32,
				(data.nodes.length * 2.5 * unit) / (2 * Math.PI),
			);
			const positions = fundsNodePositions(data.nodes, radius, snapshot?.nodes);
			const edgeStyles = fundsEdgeStyles(
				data.edges,
				data.edges.some((e) => e.aggregated) ? 3 * unit : 4,
				3 * unit,
			);
			// 预览使用固定坐标和视口；追加批次不会反复 fitView 或运行布局。
			await graph.zoomTo(
				snapshot?.zoom ??
					Math.min(
						1,
						Math.max(
							0.01,
							Math.min(width - 96, height - 120) / (2 * radius + 4 * unit),
						),
					),
				false,
			);
			if (!active()) return false;
			const [x = 0, y = 0] = graph.getViewportByCanvas([0, 0]);
			const origin: [number, number] = snapshot?.position ?? [
				width / 2,
				height / 2,
			];
			await graph.translateBy([origin[0] - x, origin[1] - y], false);
			if (!active()) return false;
			initialTheme = readTheme(container, graph, data);
			theme = initialTheme;
			themeKey = JSON.stringify(initialTheme);
			const initialEntries = entries;
			const loadVersion = version;
			const nodesDone = await drawInBatches(
				data.nodes,
				async (batch) => {
					graph.addNodeData(
						batch.map((node) => {
							const patch = nodePatch(node, initialEntries, initialTheme);
							nodesPainted.set(node.id, JSON.stringify(patch));
							nodeGeometry.set(node.id, geometryKey(patch));
							const name = accountName(node);
							return {
								...patch,
								style: {
									...patch.style,
									...positions.get(node.id),
									labelText: `${name.length > 12 ? `${name.slice(0, 12)}…` : name}\n${node.accountNumbers.length > 1 ? `${node.accountNumbers.length} 个账户` : node.number ? `尾号 ${node.number.slice(-4)}` : "账号待核"}`,
								},
							};
						}),
					);
					await graph.draw();
				},
				signal,
				(nodes) => onProgress({ nodes, edges: 0 }),
			);
			if (!nodesDone) return false;
			const edgesDone = await drawInBatches(
				data.edges,
				async (batch) => {
					graph.addEdgeData(
						batch.map((edge) => {
							const patch = edgePatch(edge, initialEntries, initialTheme);
							edgesPainted.set(edge.id, JSON.stringify(patch));
							return {
								...patch,
								source: edge.from,
								target: edge.to,
								style: {
									...patch.style,
									...edgeStyles.get(edge.id),
									labelText:
										data.edges.length <= 24
											? `${formatFunds(edge.amountMinor, edge.currency)}${edge.aggregated ? ` · ${edge.count} 笔` : ""}`
											: "",
								},
							};
						}),
					);
					await graph.draw();
				},
				signal,
				(edges) => onProgress({ nodes: data.nodes.length, edges }),
			);
			if (!edgesDone) return false;
			loaded = true;
			if (version === loadVersion) {
				applied = loadVersion;
				dirtyAll = false;
				dirtyNodes.clear();
			} else {
				await flush();
			}
			if (!active()) return false;
			// 新视图仅在完整绘制后适配一次；历史视图完全沿用保存的镜头。
			if (!snapshot && data.nodes.length) await graph.fitView(undefined, false);
			return active();
		},
	};
}
