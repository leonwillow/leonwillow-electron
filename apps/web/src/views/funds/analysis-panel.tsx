/**
 * @file 账户/主体与逐笔/汇总四种资金视图和时间顺序追踪。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：整案为入口，办案人员自行选择账户、双方或任意付款。
 * 被调用：funds 工作台；调用：Eden、G6 画布、基础 Table/Input/Button。
 * 功能：图表联动、分页、账户搜索、日期筛选、多笔交易起点和证据查看。
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
import EvidenceDialog, { type EvidenceTarget } from "./evidence-dialog";
import FlowTable from "./flow-table";
import GraphCanvas from "./graph-canvas";
import GraphToolbar, {
	emptyRelationFilter,
	type RelationFilter,
} from "./graph-toolbar";
import NodeActionMenu, { type NodeMenuTarget } from "./node-action-menu";
import NodeInspector from "./node-inspector";
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
	const [inspector, setInspector] = useState<{
		id: string;
		tab: "details" | "mark";
	} | null>(null);
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
	const [flowId, setFlowId] = useState("");
	const [offset, setOffset] = useState(0);
	const [depth, setDepth] = useState(2);
	const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
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
	const graph = useMemo(
		() =>
			filterGraph(aggregated, view.nodes, view.edges, edgeMode, appearances),
		[aggregated, view.nodes, view.edges, edgeMode, appearances],
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
		setInspector({ id, tab });
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
	const inspectedNode = inspector ? lookup.get(inspector.id) : undefined;
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
	return (
		<div className="grid min-w-0 gap-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
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
			<div className="min-w-0 space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="font-medium text-sm">
							{account ? accountName(currentAccount) : "整案资金关系"}
						</h2>
						<p className="mt-1 break-all text-muted-foreground text-xs">
							{account
								? nodeMode === "subject"
									? `${currentAccount?.accountNumbers.length ?? 0} 个账户 · ${currentAccount?.basis ?? ""}`
									: currentAccount?.number
								: "展示本案全部已导入交易，包含尚未取得本方流水的对手。"}
						</p>
					</div>
					{account && (
						<Badge variant="outline">
							{currentAccount?.hasStatement ? "已有本方流水" : "对方流水待补充"}
						</Badge>
					)}
				</div>
				<fieldset
					className="flex flex-wrap items-center gap-x-6 gap-y-3"
					aria-label="分析方式"
				>
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
				</fieldset>
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
				<div className="flex flex-wrap items-center gap-2">
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
						<Button variant="ghost" onClick={() => navigate({ traced: null })}>
							返回关系图
						</Button>
					)}
				</div>
				<p className="text-muted-foreground text-xs">
					汇总按方向分别统计，不抵销往返金额。追踪仍按原账户与交易时间连续展开，主体内部划转照常保留。关联路径不等于同一笔钱，每个起点最多展示
					200 条路径。
				</p>
				{traceError && (
					<p role="alert" className="text-destructive text-xs">
						{traceError}
					</p>
				)}
				<div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
					<p>
						单击节点查看详情，双击下钻，右键打开操作菜单。目录中可按 Shift + F10
						打开菜单。
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
													(n) => nodePresentationKey(nodeMode, n.id) === key,
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
									{nodeMode === "account" ? ` · ${n.number.slice(-4)}` : ""}
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
				{result.loading && !traced ? (
					<div
						className="flex h-96 items-center justify-center rounded-lg border text-muted-foreground text-sm"
						role="status"
					>
						正在读取资金关系…
					</div>
				) : result.error && !traced ? (
					<div role="alert" className="space-y-3 rounded-lg border p-5">
						<p className="text-sm">{result.error}</p>
						<Button onClick={() => void result.reload()}>重试查询</Button>
					</div>
				) : (
					<>
						<GraphCanvas
							viewKey={history.frame.id}
							ref={history.canvas}
							initialCanvas={history.frame.canvas}
							toolbar={
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
							}
							data={graph}
							presentation={appearances}
							onDetails={inspectNode}
							onDrill={chooseAccount}
							onNodeMenu={(id, x, y) => setNodeMenu({ id, x, y })}
							onTransaction={(id) => {
								if (edgeMode === "flow") {
									setFlowId(id);
									setOffset(0);
									setSelected([]);
								} else setEvidence({ transactionId: id });
							}}
						/>
						<div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-xs">
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
					</>
				)}
				<div className="flex items-center justify-between gap-3">
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
						{formatFunds(flow.amountMinor, flow.currency)} · {flow.count} 笔
						{flow.from === flow.to ? " · 主体内部划转" : ""}
					</p>
				)}
				{showingFlows ? (
					<FlowTable
						edges={graph.edges.slice(offset, offset + 50)}
						nodes={lookup}
						onOpen={(id) => {
							setFlowId(id);
							setOffset(0);
							setSelected([]);
						}}
					/>
				) : (
					<div className="overflow-hidden rounded-lg border">
						<Table>
							<TableHeader>
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
												checked={selected.some((item) => item.id === t.id)}
												onCheckedChange={(checked) =>
													setSelected(
														checked
															? [...selected, t]
															: selected.filter((item) => item.id !== t.id),
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
											<div
												className="max-w-80 truncate"
												title={`${accountName(lookup.get(t.from))} ${t.fromAccount} → ${accountName(lookup.get(t.to))} ${t.toAccount}`}
											>
												{accountName(lookup.get(t.from))} →{" "}
												{accountName(lookup.get(t.to))}
											</div>
											<p
												className="max-w-80 truncate text-muted-foreground"
												title={t.summary}
											>
												{t.summary || "摘要为空"}
											</p>
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
												onClick={() => setEvidence({ transactionId: t.id })}
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
				<div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
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
			</div>
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
			{inspector && inspectedNode && (
				<NodeInspector
					key={`${nodeMode}:${inspector.id}:${inspector.tab}`}
					node={inspectedNode}
					mode={nodeMode}
					full={full}
					presentation={appearances[inspector.id]}
					initialTab={inspector.tab}
					onClose={() => setInspector(null)}
					onDrill={() => chooseAccount(inspector.id)}
					onHide={() => hideNode(inspector.id)}
					onMark={(mark) => saveMark(inspector.id, mark)}
					onReset={() => resetMark(inspector.id)}
				/>
			)}
			{evidence && (
				<EvidenceDialog
					caseId={caseId}
					target={evidence}
					onClose={() => setEvidence(null)}
				/>
			)}
		</div>
	);
}

/** 沿用共享分段单选组，键盘左右箭头与 Tab 均可切换。 */
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
		<div className="flex items-center gap-2">
			<span className="shrink-0 text-muted-foreground text-xs">{label}</span>
			<RadioGroup
				aria-label={label}
				variant="segmented"
				className="w-auto grid-cols-2"
				value={value}
				onValueChange={(v) => onChange(String(v))}
			>
				{options.map(([id, text]) => (
					<Label
						key={id}
						className="relative flex cursor-pointer items-center justify-center border not-last:border-r-0 px-3 first:rounded-l-md last:rounded-r-md has-data-checked:bg-accent"
					>
						<RadioGroupItem value={id} className="sr-only absolute inset-0" />
						{text}
					</Label>
				))}
			</RadioGroup>
		</div>
	);
}
