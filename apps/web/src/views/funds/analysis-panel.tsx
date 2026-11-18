/**
 * @file 账户/主体与逐笔/汇总四种资金视图和时间顺序追踪协调容器。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-18
 * 版本作用：整案为入口，协调关系图画布、控制条与流水明细子面板。
 * 被调用：funds 工作台；调用：Eden、G6 画布、AccountDirectory、AnalysisControls、TransactionsPanel。
 * 功能：图与流水页签共用筛选范围，管理分析历史、节点标记隐藏与追踪状态。
 * 预期结果：图与明细覆盖同一完整事实范围，仅见对手照常显示，路径只作为待研判关联。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { Tabs, TabsContent } from "@leonwillow-electron/ui/components/tabs";
import { getRouteApi } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import {
	accountName,
	type FundsGraph,
	type FundsTransaction,
	fundsError,
	getFundsGraph,
	traceFunds,
} from "@/lib/funds";
import AccountDirectory from "./account-directory";
import AnalysisControls from "./analysis-controls";
import GraphCanvas from "./graph-canvas";
import GraphInspector, {
	type InspectorSelection,
	type InspectorTarget,
} from "./graph-inspector";
import GraphToolbar, {
	emptyRelationFilter,
	type RelationFilter,
} from "./graph-toolbar";
import {
	aggregateAnalysis,
	type EdgeMode,
	filterAnalysis,
	type NodeMode,
	projectAccounts,
	projectTrace,
} from "./model/analysis";
import {
	type EdgeFilter,
	emptyEdgeFilter,
	emptyNodeFilter,
	filterGraph,
	type NodeFilter,
} from "./model/graph-filters";
import { type NodeMark, nodePresentationKey } from "./model/graph-presentation";
import NodeActionMenu, { type NodeMenuTarget } from "./node-action-menu";
import TransactionsPanel from "./transactions-panel";
import { useGraphHistory } from "./use-graph-history";
import { useGraphPresentation } from "./use-graph-presentation";

const emptyGraph: Pick<FundsGraph, "nodes" | "edges"> = {
	nodes: [],
	edges: [],
};

type AnalysisView = RelationFilter & {
	nodeMode: NodeMode;
	edgeMode: EdgeMode;
	account: string;
	nodes: NodeFilter;
	edges: EdgeFilter;
	hiddenKeys: string[];
	traced: (Pick<FundsGraph, "nodes" | "edges"> & { truncated: boolean }) | null;
};

export default function AnalysisPanel({ caseId }: { caseId: string }) {
	const { user } = getRouteApi("/_workspace").useRouteContext();
	const presentation = useGraphPresentation(user.id, caseId);
	const [inspector, setInspector] = useState<InspectorTarget | null>(null);
	const [nodeMenu, setNodeMenu] = useState<NodeMenuTarget | null>(null);
	const history = useGraphHistory<AnalysisView>({
		...emptyRelationFilter,
		nodeMode: "account",
		edgeMode: "transaction",
		account: "",
		nodes: emptyNodeFilter,
		edges: emptyEdgeFilter,
		traced: null,
		hiddenKeys: Object.keys(presentation.entries).filter(
			(key) => presentation.entries[key]?.hidden,
		),
	});
	const view = history.frame.state;
	const syncHidden = useEffectEvent((entries: typeof presentation.entries) => {
		const keys = Object.keys(entries)
			.filter((key) => entries[key]?.hidden)
			.sort();
		if (JSON.stringify(keys) !== JSON.stringify([...view.hiddenKeys].sort()))
			history.replace({ ...view, hiddenKeys: keys });
	});
	useEffect(() => {
		syncHidden(presentation.entries);
	}, [presentation.entries]);
	const {
		nodeMode,
		edgeMode,
		account,
		from,
		to,
		counterparty,
		direction,
		traced,
	} = view;
	const [display, setDisplay] = useState<"graph" | "transactions">("graph");
	const [flowId, setFlowId] = useState("");
	const [offset, setOffset] = useState(0);
	const [depth, setDepth] = useState(2);
	const [selected, setSelected] = useState<FundsTransaction[]>([]);
	const [tracing, setTracing] = useState(false);
	const [traceError, setTraceError] = useState("");
	const traceRequest = useRef(0);
	const result = useAsyncResource(
		useCallback(() => getFundsGraph(caseId), [caseId]),
	);
	const full = useMemo(
		() => projectAccounts(result.data ?? emptyGraph, nodeMode),
		[result.data, nodeMode],
	);
	const appearances = useMemo(() => {
		const hiddenSet = new Set(view.hiddenKeys);
		return Object.fromEntries(
			full.nodes.map((node) => {
				const key = nodePresentationKey(nodeMode, node.id);
				return [
					node.id,
					{
						...presentation.entries[key],
						hidden: hiddenSet.has(key),
					},
				];
			}),
		);
	}, [full.nodes, nodeMode, presentation.entries, view.hiddenKeys]);
	const hiddenNodes = full.nodes.filter((node) => appearances[node.id]?.hidden);
	const source = useMemo(
		() =>
			traced
				? projectTrace(traced, nodeMode)
				: filterAnalysis(full, { account, counterparty, from, to, direction }),
		[traced, nodeMode, full, account, counterparty, from, to, direction],
	);
	const aggregated = useMemo(
		() => aggregateAnalysis(source, edgeMode),
		[source, edgeMode],
	);
	// 筛选只依赖“是否标记”；颜色、大小和隐藏样式变化不应创建新图并重置镜头。
	const markedIds = JSON.stringify(
		view.nodes.mark === "all"
			? []
			: full.nodes
					.filter((node) => appearances[node.id]?.marked)
					.map((node) => node.id),
	);
	const filterMarks = useMemo<Record<string, { marked: boolean }>>(
		() =>
			Object.fromEntries(
				(JSON.parse(markedIds) as string[]).map((id) => [id, { marked: true }]),
			),
		[markedIds],
	);
	const graph = useMemo(
		() =>
			filterGraph(aggregated, view.nodes, view.edges, edgeMode, filterMarks),
		[aggregated, view.nodes, view.edges, edgeMode, filterMarks],
	);
	const raw = useMemo(() => {
		const ids = new Set(graph.edges.flatMap((e) => e.transactionIds));
		return {
			nodes: graph.nodes,
			edges: source.edges.filter((e) => ids.has(e.id)),
		};
	}, [source, graph]);
	const currencies = useMemo(
		() => [...new Set(full.edges.map((e) => e.currency))].sort(),
		[full],
	);
	const flow = graph.edges.find((t) => t.id === flowId);
	const detailIds = flow ? new Set(flow.transactionIds) : null;
	const detailEdges = detailIds
		? raw.edges.filter((t) => detailIds.has(t.id))
		: raw.edges;
	const showingFlows = edgeMode === "flow" && !flow;
	const total = showingFlows ? graph.edges.length : detailEdges.length;
	const lookup = new Map(full.nodes.map((n) => [n.id, n]));
	const clearTransient = () => {
		traceRequest.current += 1;
		setTracing(false);
		setTraceError("");
		setSelected([]);
		setOffset(0);
		setFlowId("");
	};
	/** 明确提交一次分析操作才记历史；任何导航使旧追踪请求失效。 */
	const navigate = (patch: Partial<AnalysisView>, preserveCanvas = false) => {
		if (
			Object.entries(patch).every(
				([key, value]) =>
					view[key as keyof AnalysisView] === value ||
					(["nodes", "edges", "hiddenKeys"].includes(key) &&
						JSON.stringify(view[key as keyof AnalysisView]) ===
							JSON.stringify(value)),
			)
		)
			return;
		clearTransient();
		setInspector(null);
		setNodeMenu(null);
		const next = { ...view, ...patch };
		if (patch.hiddenKeys) presentation.setHidden(patch.hiddenKeys);
		history.push(next, preserveCanvas);
	};
	const moveHistory = (step: -1 | 1) => {
		clearTransient();
		setInspector(null);
		setNodeMenu(null);
		const next = history.move(step);
		presentation.setHidden(next.hiddenKeys);
	};
	const chooseAccount = (id: string) => {
		navigate({
			account: id,
			counterparty: "",
			traced: null,
			hiddenKeys: view.hiddenKeys.filter(
				(key) => key !== nodePresentationKey(nodeMode, id),
			),
		});
	};
	const inspectNode = (id: string, tab: "details" | "mark" = "details") => {
		setNodeMenu(null);
		setInspector({ kind: "node", id, tab });
	};
	const inspectEdge = (id: string) => {
		setNodeMenu(null);
		setInspector({ kind: "edge", id });
	};
	const hideNode = (id: string) => {
		const key = nodePresentationKey(nodeMode, id);
		navigate(
			{
				hiddenKeys: view.hiddenKeys.includes(key)
					? view.hiddenKeys.filter((k) => k !== key)
					: [...view.hiddenKeys, key],
			},
			true,
		);
	};
	const resetMark = (id: string) => {
		presentation.update(nodePresentationKey(nodeMode, id), { marked: false });
		setNodeMenu(null);
	};
	const saveMark = (id: string, mark: NodeMark) =>
		presentation.update(nodePresentationKey(nodeMode, id), {
			marked: true,
			mark,
			updatedAt: Date.now(),
		});
	const inspected: InspectorSelection | null = useMemo(() => {
		if (!inspector) return null;
		if (inspector.kind === "node") {
			const node = full.nodes.find((item) => item.id === inspector.id);
			return node ? { kind: "node", node, tab: inspector.tab } : null;
		}
		const edge = graph.edges.find((item) => item.id === inspector.id);
		if (edge) return { kind: "edge", edge };
		// 汇总内的原交易未作为画布边绘制，仍可在同一详情侧栏核对。
		const transaction = full.edges.find((item) => item.id === inspector.id);
		return transaction
			? {
					kind: "edge",
					edge: {
						...transaction,
						transactionIds: [transaction.id],
						count: 1,
						lastTimestamp: transaction.timestamp,
						aggregated: false,
					},
				}
			: null;
	}, [inspector, full, graph.edges]);
	const currentAccount = full.nodes.find((item) => item.id === account);
	const trace = async (seeds: FundsTransaction[]) => {
		if ((!account && !seeds.length) || tracing) return;
		if (seeds.length > 10) {
			setTraceError("单次追踪最多 10 个起点，请分批开展分析。");
			return;
		}
		setTracing(true);
		setTraceError("");
		const request = ++traceRequest.current;
		try {
			const data = await Promise.all(
				(seeds.length
					? seeds.map((seed) => ({
							account: seed.fromAccount,
							transaction: seed.id,
						}))
					: [{ account, transaction: "" }]
				).map((seed) => traceFunds(caseId, { ...seed, depth, from, to })),
			);
			if (request !== traceRequest.current) return;
			setOffset(0);
			setFlowId("");
			navigate({
				traced: {
					nodes: [
						...new Map(
							data.flatMap((item) => item.nodes).map((node) => [node.id, node]),
						).values(),
					],
					edges: [
						...new Map(
							data.flatMap((item) => item.edges).map((edge) => [edge.id, edge]),
						).values(),
					],
					truncated: data.some((item) => item.truncated),
				},
			});
		} catch (error) {
			if (request === traceRequest.current) setTraceError(fundsError(error));
		} finally {
			if (request === traceRequest.current) setTracing(false);
		}
	};
	const filterToolbar = (
		<GraphToolbar
			nodes={view.nodes}
			edges={view.edges}
			relation={{ from, to, counterparty, direction }}
			edgeMode={edgeMode}
			hasAccount={!!account}
			currencies={currencies}
			canBack={history.canBack}
			canForward={history.canForward}
			onBack={() => moveHistory(-1)}
			onForward={() => moveHistory(1)}
			onNodes={(nodes) => navigate({ nodes })}
			onEdges={(edges, relation) =>
				navigate({
					edges,
					...relation,
					traced:
						relation.from !== from ||
						relation.to !== to ||
						relation.counterparty !== counterparty ||
						relation.direction !== direction
							? null
							: traced,
				})
			}
			onClear={() =>
				navigate({
					nodes: emptyNodeFilter,
					edges: emptyEdgeFilter,
					...emptyRelationFilter,
					traced: null,
				})
			}
		/>
	);
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden xl:flex-row">
			<AccountDirectory
				full={full}
				mode={nodeMode}
				appearances={appearances}
				account={account}
				loading={result.loading}
				onInspect={inspectNode}
				onDrill={chooseAccount}
				onMenu={setNodeMenu}
			/>
			<Tabs
				value={display}
				onValueChange={(value) => {
					if (value === "graph" || value === "transactions") {
						setDisplay(value);
						setNodeMenu(null);
					}
				}}
				className="min-h-0 min-w-0 flex-1 gap-4 overflow-hidden p-workspace-gutter"
			>
				<AnalysisControls
					nodeMode={nodeMode}
					edgeMode={edgeMode}
					depth={depth}
					account={account}
					currentAccount={currentAccount}
					selectedCount={selected.length}
					tracing={tracing}
					hasTraced={!!traced}
					traceError={traceError}
					onNodeModeChange={(nextMode) =>
						navigate({
							nodeMode: nextMode,
							account: "",
							counterparty: "",
							traced: null,
						})
					}
					onEdgeModeChange={(nextMode) => navigate({ edgeMode: nextMode })}
					onDepthChange={setDepth}
					onTraceAccount={() => void trace([])}
					onTraceSelected={() => void trace(selected)}
					onExitTrace={() => navigate({ traced: null })}
				/>
				{result.loading && !traced ? (
					<ScrollArea
						role="status"
						className="min-h-0 flex-1 rounded-lg border text-muted-foreground text-sm"
						contentClassName="flex items-center justify-center"
					>
						正在读取资金关系…
					</ScrollArea>
				) : result.error && !traced ? (
					<ScrollArea
						role="alert"
						className="min-h-0 flex-1 rounded-lg border"
						contentClassName="space-y-3 p-5"
					>
						<p className="text-sm">{result.error}</p>
						<Button onClick={() => void result.reload()}>重试查询</Button>
					</ScrollArea>
				) : (
					<>
						<TabsContent
							value="graph"
							keepMounted
							className="flex min-h-0 flex-col gap-4 overflow-hidden data-[hidden]:hidden"
						>
							<ScrollArea
								className="max-h-1/4 shrink-0 overscroll-contain"
								contentClassName="space-y-4"
							>
								<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
									<p>
										单击节点查看详情，双击下钻，右键打开操作菜单。目录中可按
										Shift + F10 打开菜单。
									</p>
									{hiddenNodes.length > 0 && (
										<Button
											variant="outline"
											onClick={() =>
												navigate(
													{
														hiddenKeys: view.hiddenKeys.filter(
															(key) =>
																!hiddenNodes.some(
																	(n) =>
																		nodePresentationKey(nodeMode, n.id) === key,
																),
														),
													},
													true,
												)
											}
										>
											恢复全部隐藏节点（{hiddenNodes.length}）
										</Button>
									)}
								</div>
								{hiddenNodes.length > 0 && (
									<details className="text-xs">
										<summary className="cursor-pointer text-muted-foreground">
											查看已隐藏节点
										</summary>
										<ScrollArea
											className="mt-2 max-h-40"
											contentClassName="flex flex-wrap gap-2"
										>
											{hiddenNodes.map((n) => (
												<Button
													key={n.id}
													variant="outline"
													size="sm"
													onClick={() => hideNode(n.id)}
												>
													恢复 {accountName(n)}
													{nodeMode === "account"
														? ` · ${n.number.slice(-4)}`
														: ""}
												</Button>
											))}
										</ScrollArea>
									</details>
								)}
								{presentation.error && (
									<p role="alert" className="text-destructive text-xs">
										{presentation.error}
									</p>
								)}
							</ScrollArea>
							<GraphCanvas
								userId={user.id}
								viewKey={history.frame.id}
								ref={history.canvas}
								initialCanvas={history.frame.canvas}
								toolbar={display === "graph" ? filterToolbar : undefined}
								data={graph}
								nodeMode={nodeMode}
								presentation={appearances}
								onDetails={inspectNode}
								onDrill={chooseAccount}
								onNodeMenu={(id, x, y) => setNodeMenu({ id, x, y })}
								onTransaction={inspectEdge}
							/>
							<ScrollArea
								className="max-h-1/4 shrink-0 overscroll-contain text-muted-foreground text-xs"
								contentClassName="flex flex-wrap justify-between gap-2"
							>
								<span>
									默认实心：已有流水 · 默认空心：对方流水待补 · 箭头：资金方向 ·
									标记后可点选查看覆盖情况
								</span>
								<span>
									{graph.nodes.length} 个
									{nodeMode === "subject" ? "主体节点" : "账户节点"} ·{" "}
									{edgeMode === "flow" ? `${graph.edges.length} 条流向 · ` : ""}
									{raw.edges.length} 笔交易
									{traced
										? traced.truncated
											? " · 路径已截断，请缩小时间范围"
											: " · 时间有序关联"
										: " · 当前范围全部交易"}
									{graph.nodes.some((n) => appearances[n.id]?.hidden)
										? ` · 画布隐藏 ${graph.nodes.filter((n) => appearances[n.id]?.hidden).length} 个节点，明细保持完整`
										: ""}
								</span>
							</ScrollArea>
						</TabsContent>
						<TransactionsPanel
							frameId={history.frame.id}
							flowId={flowId}
							flow={flow}
							showingFlows={showingFlows}
							hasTraced={!!traced}
							loading={result.loading}
							offset={offset}
							total={total}
							flowEdges={graph.edges.slice(offset, offset + 50)}
							transactionEdges={detailEdges.slice(offset, offset + 50)}
							lookup={lookup}
							selected={selected}
							filterToolbar={filterToolbar}
							onOpenFlow={(id) => {
								setFlowId(id);
								setOffset(0);
								setSelected([]);
							}}
							onCloseFlow={() => {
								setFlowId("");
								setOffset(0);
								setSelected([]);
							}}
							onSelectionChange={setSelected}
							onOffsetChange={setOffset}
							onInspectEdge={inspectEdge}
						/>
					</>
				)}
			</Tabs>
			{nodeMenu && (
				<NodeActionMenu
					key={`${nodeMenu.id}:${nodeMenu.x}:${nodeMenu.y}`}
					target={nodeMenu}
					name={accountName(lookup.get(nodeMenu.id))}
					hidden={!!appearances[nodeMenu.id]?.hidden}
					marked={!!appearances[nodeMenu.id]?.marked}
					onClose={() => setNodeMenu(null)}
					onDetails={() => inspectNode(nodeMenu.id)}
					onDrill={() => chooseAccount(nodeMenu.id)}
					onMark={() => inspectNode(nodeMenu.id, "mark")}
					onHide={() => hideNode(nodeMenu.id)}
					onReset={() => resetMark(nodeMenu.id)}
				/>
			)}
			{inspector && inspected && (
				<GraphInspector
					selection={inspected}
					caseId={caseId}
					mode={nodeMode}
					full={full}
					presentation={
						inspector.kind === "node" ? appearances[inspector.id] : undefined
					}
					onClose={() => setInspector(null)}
					onTabChange={(tab) =>
						setInspector((current) =>
							current?.kind === "node" ? { ...current, tab } : current,
						)
					}
					onDrill={() => chooseAccount(inspector.id)}
					onHide={() => hideNode(inspector.id)}
					onMark={(mark) => saveMark(inspector.id, mark)}
					onReset={() => resetMark(inspector.id)}
					onEdge={inspectEdge}
				/>
			)}
		</div>
	);
}
