/**
 * @file 账户交易图、交易明细和时间顺序追踪。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
	accountName,
	type FundsGraph,
	type FundsTransaction,
	formatFunds,
	fundsError,
	getFundsAccounts,
	getFundsGraph,
	traceFunds,
} from "@/lib/funds";
import EvidenceDialog, { type EvidenceTarget } from "./evidence-dialog";
import GraphCanvas from "./graph-canvas";
import { useFundsResource } from "./use-funds-resource";

export default function AnalysisPanel({ caseId }: { caseId: string }) {
	const [account, setAccount] = useState("");
	const [search, setSearch] = useState("");
	const [term, setTerm] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [counterparty, setCounterparty] = useState("");
	const [direction, setDirection] = useState<"both" | "in" | "out">("both");
	const [offset, setOffset] = useState(0);
	const [depth, setDepth] = useState(2);
	const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
	const [selected, setSelected] = useState<FundsTransaction[]>([]);
	const [traced, setTraced] = useState<
		(Pick<FundsGraph, "nodes" | "edges"> & { truncated: boolean }) | null
	>(null);
	const [tracing, setTracing] = useState(false);
	const [traceError, setTraceError] = useState("");
	const traceRequest = useRef(0);
	const accounts = useFundsResource(
		useCallback(() => getFundsAccounts(caseId, term), [caseId, term]),
	);
	const result = useFundsResource(
		useCallback(
			() =>
				getFundsGraph(caseId, { account, counterparty, from, to, direction }),
			[caseId, account, counterparty, from, to, direction],
		),
	);
	const resetTrace = () => {
		traceRequest.current += 1;
		setTracing(false);
		setTraced(null);
		setTraceError("");
		setSelected([]);
		setOffset(0);
	};
	const chooseAccount = (id: string) => {
		setAccount(id);
		resetTrace();
	};
	const currentAccount =
		accounts.data?.find((item) => item.id === account) ??
		result.data?.nodes.find((item) => item.id === account);
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
					? seeds.map((seed) => ({ account: seed.from, transaction: seed.id }))
					: [{ account, transaction: "" }]
				).map((seed) => traceFunds(caseId, { ...seed, depth, from, to })),
			);
			if (request !== traceRequest.current) return;
			setOffset(0);
			setTraced({
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
			});
		} catch (error) {
			if (request === traceRequest.current) setTraceError(fundsError(error));
		} finally {
			if (request === traceRequest.current) setTracing(false);
		}
	};
	const graph = traced ?? result.data;
	// 明细只分页显示；翻页不重新取图或重建画布，确保图和明细来自同一结果。
	const table = graph
		? {
				nodes: graph.nodes,
				edges: graph.edges.slice(offset, offset + 50),
				total: graph.edges.length,
			}
		: null;
	const lookup = new Map(
		[
			...(accounts.data ?? []),
			...(table?.nodes ?? []),
			...(graph?.nodes ?? []),
		].map((node) => [node.id, node]),
	);
	return (
		<div className="grid min-w-0 gap-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
			<aside className="min-w-0 space-y-3" aria-label="案件账户">
				<div className="flex items-center justify-between">
					<h2 className="font-medium text-sm">主体与账户</h2>
					<Button variant="ghost" onClick={() => chooseAccount("")}>
						整案视图
					</Button>
				</div>
				<form
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						setTerm(search);
					}}
				>
					<Input
						aria-label="搜索账户或户名"
						placeholder="搜索户名或完整账号"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<Button
						type="submit"
						size="icon"
						variant="outline"
						aria-label="搜索账户"
					>
						<SearchIcon />
					</Button>
				</form>
				<p className="text-muted-foreground text-xs">
					有本方流水的账户优先。仅见对手的账户可作为下一步调取线索。
				</p>
				{accounts.error && (
					<p role="alert" className="text-destructive text-xs">
						{accounts.error}
					</p>
				)}
				<div className="max-h-64 overflow-auto rounded-lg border xl:max-h-[42rem]">
					{accounts.loading && (
						<p className="p-3 text-muted-foreground text-xs" role="status">
							正在读取账户…
						</p>
					)}
					{accounts.data?.map((item) => (
						<button
							type="button"
							key={item.id}
							aria-pressed={account === item.id}
							onClick={() => chooseAccount(item.id)}
							className={`flex w-full flex-col gap-1 border-b p-3 text-left text-xs outline-none last:border-0 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${account === item.id ? "bg-primary/10" : ""}`}
						>
							<span className="flex w-full justify-between gap-2">
								<span className="break-words font-medium">
									{accountName(item)}
								</span>
								<span className="shrink-0 text-muted-foreground tabular-nums">
									{item.transactionCount} 笔
								</span>
							</span>
							<span className="break-all font-mono text-muted-foreground">
								{item.number}
							</span>
							<span className="text-muted-foreground">
								{item.hasStatement ? "已有本方流水" : "仅见交易对手 · 待补流水"}
								{item.ownNames.length > 1 ? " · 户名冲突" : ""}
							</span>
						</button>
					))}
					{accounts.data?.length === 0 && (
						<p className="p-3 text-muted-foreground text-xs">
							没有找到匹配账户。
						</p>
					)}
				</div>
				<p className="text-muted-foreground text-xs">
					最多显示 200 个账户，可搜索定位其余账户。
				</p>
			</aside>
			<div className="min-w-0 space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="font-medium text-sm">
							{account ? accountName(currentAccount) : "整案资金关系"}
						</h2>
						<p className="mt-1 break-all text-muted-foreground text-xs">
							{account ||
								"展示本案已导入的全部交易关系，包含尚未取得本方流水的交易对手。"}
						</p>
					</div>
					{account && (
						<Badge variant="outline">
							{currentAccount?.hasStatement ? "已有本方流水" : "对方流水待补充"}
						</Badge>
					)}
				</div>
				<fieldset
					disabled={tracing}
					className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4"
				>
					<legend className="sr-only">交易筛选</legend>
					<div className="space-y-1">
						<Label htmlFor="funds-from">开始日期</Label>
						<Input
							id="funds-from"
							type="date"
							value={from}
							onInput={(event) => {
								setFrom(event.currentTarget.value);
								resetTrace();
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="funds-to">结束日期</Label>
						<Input
							id="funds-to"
							type="date"
							value={to}
							min={from}
							onInput={(event) => {
								setTo(event.currentTarget.value);
								resetTrace();
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="funds-counterparty">指定交易对手账号</Label>
						<Input
							id="funds-counterparty"
							value={counterparty}
							placeholder="可选，输入完整账号"
							onChange={(event) => {
								setCounterparty(event.target.value.trim());
								resetTrace();
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label>所选账户方向</Label>
						<div className="flex gap-1">
							{(
								[
									["both", "全部"],
									["out", "支出"],
									["in", "收入"],
								] as const
							).map(([value, label]) => (
								<Button
									key={value}
									variant={direction === value ? "secondary" : "ghost"}
									aria-pressed={direction === value}
									disabled={!account}
									onClick={() => {
										setDirection(value);
										resetTrace();
									}}
								>
									{label}
								</Button>
							))}
						</div>
					</div>
				</fieldset>
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
						从此账户向下追踪
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
							onClick={() => {
								setTraced(null);
								setOffset(0);
							}}
						>
							返回关系图
						</Button>
					)}
				</div>
				<p className="text-muted-foreground text-xs">
					追踪按交易发生时间向下展开。账户内资金会混同，关联路径和闭环不等于同一笔钱已回流。每个起点最多展示
					200 条路径。
				</p>
				{traceError && (
					<p role="alert" className="text-destructive text-xs">
						{traceError}
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
				) : graph?.nodes.length ? (
					<>
						<GraphCanvas
							data={graph}
							onAccount={chooseAccount}
							onTransaction={(transactionId) => setEvidence({ transactionId })}
						/>
						<div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-xs">
							<span>
								实心节点：已有流水 · 空心节点：对方流水待补 · 箭头：资金方向
							</span>
							<span>
								{graph.nodes.length} 个节点 · {graph.edges.length} 条交易
								{traced
									? traced.truncated
										? " · 路径已截断，请缩小时间范围"
										: " · 时间有序关联"
									: " · 当前范围全部展示"}
							</span>
						</div>
					</>
				) : (
					<div className="rounded-lg border p-8 text-center text-muted-foreground text-sm">
						此范围没有交易关系。可更换账户、清空对手账号或扩大日期范围。
					</div>
				)}
				<div className="flex items-center justify-between gap-3">
					<h3 className="font-medium text-sm">
						{traced ? "追踪结果明细" : "交易明细"}{" "}
						<span className="text-muted-foreground">
							{table?.total.toLocaleString("zh-CN") ?? "—"} 笔
						</span>
					</h3>
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
											title={`${accountName(lookup.get(t.from))} ${lookup.get(t.from)?.number} → ${accountName(lookup.get(t.to))} ${lookup.get(t.to)?.number}`}
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
