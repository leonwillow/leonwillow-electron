/**
 * @file 资金分析工作区的视图切换、追踪控制栏与当前账户/主体摘要头。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-19
 * 版本作用：从 analysis-panel 拆分出顶部操作条与当前分析对象说明，保持单组件职责聚焦。
 * 被调用：views/funds/analysis-panel.tsx。
 * 调用：ui 基础组件、lib/funds、model/analysis。
 * 功能：切换关系图/流水页签、节点与连线粒度、追踪层数与发起追踪，展示主体包含账户详情。
 * 预期结果：保持原有全部可访问标签、操作按钮与主体下钻说明不变。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { HelpTip } from "@leonwillow-electron/ui/components/help-tip";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@leonwillow-electron/ui/components/radio-group";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { TabsList, TabsTrigger } from "@leonwillow-electron/ui/components/tabs";
import { ArrowRightIcon } from "lucide-react";
import { accountName, type FundsAccount } from "@/lib/funds";
import type { EdgeMode, NodeMode } from "./model/analysis";

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

export default function AnalysisControls({
	nodeMode,
	edgeMode,
	depth,
	account,
	currentAccount,
	selectedCount,
	tracing,
	hasTraced,
	traceError,
	onNodeModeChange,
	onEdgeModeChange,
	onDepthChange,
	onTraceAccount,
	onTraceSelected,
	onExitTrace,
}: {
	nodeMode: NodeMode;
	edgeMode: EdgeMode;
	depth: number;
	account: string;
	currentAccount?: FundsAccount;
	selectedCount: number;
	tracing: boolean;
	hasTraced: boolean;
	traceError: string;
	onNodeModeChange: (mode: NodeMode) => void;
	onEdgeModeChange: (mode: EdgeMode) => void;
	onDepthChange: (depth: number) => void;
	onTraceAccount: () => void;
	onTraceSelected: () => void;
	onExitTrace: () => void;
}) {
	return (
		<>
			<ScrollArea
				className="-mx-1 -mt-1 shrink-0 overscroll-x-contain"
				contentClassName="p-1"
			>
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
						onChange={(value) => onNodeModeChange(value as NodeMode)}
					/>
					<AnalysisMode
						label="连线"
						value={edgeMode}
						options={[
							["transaction", "逐笔交易"],
							["flow", "汇总流向"],
						]}
						onChange={(value) => onEdgeModeChange(value as EdgeMode)}
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
								onDepthChange(
									Math.max(1, Math.min(4, Number(event.target.value) || 1)),
								)
							}
						/>
						<Button
							variant="outline"
							disabled={!account || tracing}
							onClick={onTraceAccount}
						>
							从此{nodeMode === "subject" ? "主体" : "账户"}向下追踪
							<ArrowRightIcon />
						</Button>
						<Button
							disabled={!selectedCount || tracing}
							onClick={onTraceSelected}
						>
							{tracing ? "正在追踪…" : `追踪所选 ${selectedCount} 笔`}
						</Button>
						{hasTraced && (
							<Button variant="ghost" onClick={onExitTrace}>
								返回关系图
							</Button>
						)}
						<HelpTip
							label="资金汇总与追踪口径"
							content="汇总按方向分别统计，不抵销往返金额。追踪按原账户与交易时间连续展开，主体内部划转照常保留；关联路径不等于同一笔钱，每个起点最多展示 200 条路径。"
						/>
					</div>
				</fieldset>
			</ScrollArea>
			{(account || traceError) && (
				<ScrollArea
					className="max-h-1/4 shrink-0 overscroll-contain"
					contentClassName="space-y-4"
				>
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
					{traceError && (
						<p role="alert" className="text-destructive-foreground text-xs">
							{traceError}
						</p>
					)}
				</ScrollArea>
			)}
		</>
	);
}
