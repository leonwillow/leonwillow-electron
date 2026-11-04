/**
 * @file 账户/主体与逐笔/汇总四种资金视图和时间顺序追踪。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-08
 * 版本作用：整案为入口，办案人员自行选择账户、双方或任意付款。
 * 被调用：funds 工作台；调用：Eden、G6 画布、共享 Tabs/Table/Input/Button。
 * 功能：图与流水页签共用筛选范围，保留分页、选择、账户搜索和证据查看。
 * 预期结果：图与明细覆盖同一完整事实范围，仅见对手照常显示，路径只作为待研判关联。
 */

import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@leonwillow-electron/ui/components/radio-group";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	accountName,
	type FundsGraph,
	type FundsTransaction,
	formatFunds,
	fundsError,
	getFundsGraph,
	traceFunds,
} from "@/lib/funds";
import {
	aggregateAnalysis,
	type EdgeMode,
	filterAnalysis,
	type NodeMode,
	projectAccounts,
	projectTrace,
} from "@/lib/funds-analysis";
import {
	type EdgeFilter,
	emptyEdgeFilter,
	emptyNodeFilter,
	filterGraph,
	type NodeFilter,
} from "@/lib/funds-graph-filters";
import {
	type NodeMark,
	nodePresentationKey,
} from "@/lib/funds-graph-presentation";
import AccountDirectory from "./account-directory";
import FlowTable from "./flow-table";
import GraphCanvas from "./graph-canvas";
import GraphInspector, {
	type InspectorSelection,
	type InspectorTarget,
} from "./graph-inspector";
import GraphToolbar, {
	emptyRelationFilter,
	type RelationFilter,
} from "./graph-toolbar";
import NodeActionMenu, { type NodeMenuTarget } from "./node-action-menu";
import { useFundsResource } from "./use-funds-resource";
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
	const result = useFundsResource(
		useCallback(() => getFundsGraph(caseId), [caseId]),
	);
	const full = useMemo(
		() => projectAccounts(result.data ?? emptyGraph, nodeMode),
		[result.data, nodeMode],
	);
	const appearances = useMemo(
		() =>
			Object.fromEntries(
				full.nodes.map((node) => [
					node.id,
					{
						...presentation.entries[nodePresentationKey(nodeMode, node.id)],
						hidden: view.hiddenKeys.includes(
							nodePresentationKey(nodeMode, node.id),
						),
					},
				]),
			),
		[full.nodes, nodeMode, presentation.entries, view.hiddenKeys],
	);
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
	const table = {
		nodes: raw.nodes,
		edges: detailEdges.slice(offset, offset + 50),
		total: showingFlows ? graph.edges.length : detailEdges.length,
	};
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
				<div className="-mx-1 -mt-1 shrink-0 overflow-x-auto overscroll-x-contain p-1">
					<fieldset
						className="flex w-max min-w-full items-center gap-6"
						aria-label="资金分析操作"
					>
						<TabsList aria-label="分析视图" className="shrink-0">
							<TabsTrigger value="graph">资金关系图</TabsTrigger>
							<TabsTrigger value="transactions">银行流水</TabsTrigger>
						</TabsList>

						<AnalysisMode
							label="节点"
							value={nodeMode}
							options={[
								["account", "按账户"],
								["subject", "合并主体"],
							]}
							onChange={(value) => {
								navigate({
									nodeMode: value as NodeMode,
									account: "",
									counterparty: "",
									traced: null,
								});
							}}
						/>
						<AnalysisMode
							label="连线"
							value={edgeMode}
							options={[
								["transaction", "逐笔交易"],
								["flow", "汇总流向"],
							]}
							onChange={(value) => {
								navigate({ edgeMode: value as EdgeMode });
							}}
						/>
						<div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
							<Label htmlFor="trace-depth">追踪层数</Label>
							<Input
								id="trace-depth"
								className="w-16"
								type="number"
								min={1}
								max={4}
								value={depth}
								onChange={(event) =>
									setDepth(
										Math.max(1, Math.min(4, Number(event.target.value) || 1)),
									)
								}
							/>
							<Button
								variant="outline"
								disabled={!account || tracing}
								onClick={() => void trace([])}
							>
								从此{nodeMode === "subject" ? "主体" : "账户"}向下追踪
								<ArrowRightIcon />
							</Button>
							<Button
								disabled={!selected.length || tracing}
								onClick={() => void trace(selected)}
							>
								{tracing ? "正在追踪…" : `追踪所选 ${selected.length} 笔`}
							</Button>
							{traced && (
								<Button
									variant="ghost"
									onClick={() => navigate({ traced: null })}
								>
									返回关系图
								</Button>
							)}
						</div>
					</fieldset>
				</div>
				<div className="max-h-1/4 shrink-0 space-y-4 overflow-y-auto overscroll-contain">
					{account && (
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h2 className="font-medium text-sm">
									{accountName(currentAccount)}
								</h2>
								<p className="mt-1 break-all text-muted-foreground text-xs">
									{nodeMode === "subject"
										? `${currentAccount?.accountNumbers.length ?? 0} 个账户 · ${currentAccount?.basis ?? ""}`
										: currentAccount?.number}
								</p>
							</div>
							<Badge variant="outline">
								{currentAccount?.hasStatement
									? "已有本方流水"
									: "对方流水待补充"}
							</Badge>
						</div>
					)}
					{nodeMode === "subject" && currentAccount && (
						<details className="text-xs">
							<summary className="cursor-pointer text-muted-foreground">
								查看主体包含的账户与归属依据
							</summary>
							<p className="mt-2">
								{currentAccount.basis}；可在案件管理的清洗核对中更正。
							</p>
							<ul className="mt-2 space-y-1">
								{currentAccount.accounts.map((a) => (
									<li key={a.id} className="break-all">
										{a.number} ·{" "}
										{(a.ownNames.length ? a.ownNames : a.names).join(" / ")} ·{" "}
										{a.hasStatement ? "已有流水" : "仅见对手"}
									</li>
								))}
							</ul>
						</details>
					)}
					<p className="text-muted-foreground text-xs">
						汇总按方向分别统计，不抵销往返金额。追踪仍按原账户与交易时间连续展开，主体内部划转照常保留。关联路径不等于同一笔钱，每个起点最多展示
						200 条路径。
					</p>
					{traceError && (
						<p role="alert" className="text-destructive text-xs">
							{traceError}
						</p>
					)}
				</div>
				{result.loading && !traced ? (
					<div
						className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border text-muted-foreground text-sm"
						role="status"
					>
						正在读取资金关系…
					</div>
				) : result.error && !traced ? (
					<div
						role="alert"
						className="min-h-0 flex-1 space-y-3 overflow-auto rounded-lg border p-5"
					>
						<p className="text-sm">{result.error}</p>
						<Button onClick={() => void result.reload()}>重试查询</Button>
					</div>
				) : (
					<>
						<TabsContent
							value="graph"
							keepMounted
							className="flex min-h-0 flex-col gap-4 overflow-hidden data-[hidden]:hidden"
						>
							<div className="max-h-1/4 shrink-0 space-y-4 overflow-y-auto overscroll-contain">
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
										<div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
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
										</div>
									</details>
								)}
								{presentation.error && (
									<p role="alert" className="text-destructive text-xs">
										{presentation.error}
									</p>
								)}
							</div>
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
							<div className="flex max-h-1/4 shrink-0 flex-wrap justify-between gap-2 overflow-y-auto overscroll-contain text-muted-foreground text-xs">
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
							</div>
						</TabsContent>
						<TabsContent
							value="transactions"
							className="flex min-h-0 flex-col gap-4 overflow-hidden"
						>
							<div className="max-h-1/3 shrink-0 space-y-4 overflow-y-auto overscroll-contain">
								<div className="flex flex-wrap items-center gap-3">
									<h3 className="font-medium text-sm">
										{flow
											? "流向包含的交易"
											: showingFlows
												? "资金流向汇总"
												: traced
													? "追踪结果明细"
													: "交易明细"}{" "}
										<span className="text-muted-foreground">
											{table.total.toLocaleString("zh-CN")}{" "}
											{showingFlows ? "条流向" : "笔"}
										</span>
									</h3>
									{flow && (
										<Button
											variant="outline"
											onClick={() => {
												setFlowId("");
												setOffset(0);
												setSelected([]);
											}}
										>
											返回流向汇总
										</Button>
									)}
									{selected.length > 0 && (
										<Button variant="ghost" onClick={() => setSelected([])}>
											清空选择
										</Button>
									)}
									<fieldset
										className="ml-auto flex shrink-0 items-center gap-1"
										aria-label="银行流水筛选工具"
									>
										{filterToolbar}
									</fieldset>
								</div>
								{traced && (
									<p className="text-muted-foreground text-xs">
										这里列出画布中全部追踪交易，包含展开后的后续交易；同一笔交易只列一次，可逐条核对来源。
									</p>
								)}
								{flow && (
									<p className="text-sm">
										{accountName(lookup.get(flow.from))} →{" "}
										{accountName(lookup.get(flow.to))} ·{" "}
										{formatFunds(flow.amountMinor, flow.currency)} ·{" "}
										{flow.count} 笔
										{flow.from === flow.to ? " · 主体内部划转" : ""}
									</p>
								)}
							</div>
							{showingFlows ? (
								<FlowTable
									key={`${history.frame.id}:${flowId}:${offset}`}
									edges={graph.edges.slice(offset, offset + 50)}
									nodes={lookup}
									onOpen={(id) => {
										setFlowId(id);
										setOffset(0);
										setSelected([]);
									}}
								/>
							) : (
								<div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
									<Table
										key={`${history.frame.id}:${flowId}:${offset}`}
										containerProps={{
											className:
												"h-full overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
											role: "region",
											"aria-label": "银行流水数据",
											tabIndex: 0,
										}}
									>
										<TableHeader className="sticky top-0 z-10 bg-background">
											<TableRow>
												<TableHead>选择</TableHead>
												<TableHead>交易时间</TableHead>
												<TableHead>付款方 → 收款方</TableHead>
												<TableHead className="text-right">金额</TableHead>
												<TableHead>核对状态</TableHead>
												<TableHead>来源</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{table?.edges.map((t) => (
												<TableRow key={t.id}>
													<TableCell>
														<Checkbox
															aria-label={`选择 ${t.timestamp.slice(0, 19)} ${formatFunds(t.amountMinor)} 交易`}
															checked={selected.some(
																(item) => item.id === t.id,
															)}
															onCheckedChange={(checked) =>
																setSelected(
																	checked
																		? [...selected, t]
																		: selected.filter(
																				(item) => item.id !== t.id,
																			),
																)
															}
														/>
													</TableCell>
													<TableCell className="whitespace-nowrap text-xs tabular-nums">
														{t.timestamp.slice(0, 10)}
														<br />
														<span className="text-muted-foreground">
															{t.timestamp.slice(11, 19)}
														</span>
													</TableCell>
													<TableCell className="text-xs">
														<TooltipText
															content={`${accountName(lookup.get(t.from))} ${t.fromAccount} → ${accountName(lookup.get(t.to))} ${t.toAccount}`}
														>
															<div className="w-fit max-w-80 truncate">
																{accountName(lookup.get(t.from))} →{" "}
																{accountName(lookup.get(t.to))}
															</div>
														</TooltipText>
														<TooltipText content={t.summary}>
															<p className="w-fit max-w-80 truncate text-muted-foreground">
																{t.summary || "摘要为空"}
															</p>
														</TooltipText>
													</TableCell>
													<TableCell className="text-right font-medium text-xs tabular-nums">
														{formatFunds(t.amountMinor, t.currency)}
													</TableCell>
													<TableCell className="text-xs">
														{t.reconciliation === "single"
															? "单边记录"
															: t.reconciliation === "mirror"
																? "双边一致"
																: "人工核对"}
													</TableCell>
													<TableCell>
														<Button
															size="sm"
															variant="ghost"
															onClick={() => inspectEdge(t.id)}
														>
															核对 {t.evidenceIds.length} 条
														</Button>
													</TableCell>
												</TableRow>
											))}
											{table?.edges.length === 0 && (
												<TableRow>
													<TableCell
														colSpan={6}
														className="py-8 text-center text-muted-foreground"
													>
														当前条件没有交易。
													</TableCell>
												</TableRow>
											)}
										</TableBody>
									</Table>
								</div>
							)}
							<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
								<span>
									{table?.total
										? `${offset + 1}–${Math.min(offset + 50, table.total)} / ${table.total}`
										: "0 条"}{" "}
									· 时间采用银行本地时间（UTC+8）
								</span>
								<div className="flex gap-2">
									<Button
										variant="outline"
										disabled={!offset || (!traced && result.loading)}
										onClick={() => setOffset(Math.max(0, offset - 50))}
									>
										上一页
									</Button>
									<Button
										variant="outline"
										disabled={
											!table ||
											offset + 50 >= table.total ||
											(!traced && result.loading)
										}
										onClick={() => setOffset(offset + 50)}
									>
										下一页
									</Button>
								</div>
							</div>
						</TabsContent>
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

/** 模式选项沿用单选语义，外观与同一工具行的视图页签保持一致。 */
function AnalysisMode({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: [string, string][];
	onChange: (value: string) => void;
}) {
	return (
		<div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
			<span className="shrink-0 text-muted-foreground text-xs">{label}</span>
			<RadioGroup
				aria-label={label}
				variant="tabs"
				value={value}
				onValueChange={(v) => onChange(String(v))}
			>
				{options.map(([id, text]) => (
					<Label key={id}>
						<RadioGroupItem value={id} className="sr-only absolute inset-0" />
						{text}
					</Label>
				))}
			</RadioGroup>
		</div>
	);
}
