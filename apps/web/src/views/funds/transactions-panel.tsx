/**
 * @file 资金分析工作区的银行流水与汇总流向页签面板。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-21
 * 版本作用：从 analysis-panel 拆分出汇总流向表、逐笔明细表、多选追踪勾选与分页栏。
 * 被调用：views/funds/analysis-panel.tsx。
 * 调用：ui 基础组件、FlowTable、lib/funds、model/analysis。
 * 功能：展示汇总或逐笔流水、支持按流向下钻、勾选起点交易及证据回溯。
 * 预期结果：保持表格无障碍语义、筛选工具栏嵌入与分页状态一致。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import { HelpTip } from "@leonwillow-electron/ui/components/help-tip";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import { TabsContent } from "@leonwillow-electron/ui/components/tabs";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import type { ReactNode } from "react";
import {
	accountName,
	type FundsAccount,
	type FundsTransaction,
	formatFunds,
} from "@/lib/funds";
import FlowTable from "./flow-table";
import { GraphToolbarContext } from "./graph-toolbar-context";
import type { AnalysisEdge } from "./model/analysis";

const TRANSACTIONS_TOOLBAR_CONTEXT = {
	side: "bottom" as const,
	onPopupChange: () => {},
};

export default function TransactionsPanel({
	frameId,
	flowId,
	flow,
	showingFlows,
	hasTraced,
	loading,
	offset,
	total,
	flowEdges,
	transactionEdges,
	lookup,
	selected,
	filterToolbar,
	onOpenFlow,
	onCloseFlow,
	onSelectionChange,
	onOffsetChange,
	onInspectEdge,
}: {
	frameId: number;
	flowId: string;
	flow?: AnalysisEdge;
	showingFlows: boolean;
	hasTraced: boolean;
	loading: boolean;
	offset: number;
	total: number;
	flowEdges: AnalysisEdge[];
	transactionEdges: FundsTransaction[];
	lookup: Map<string, FundsAccount>;
	selected: FundsTransaction[];
	filterToolbar: ReactNode;
	onOpenFlow: (id: string) => void;
	onCloseFlow: () => void;
	onSelectionChange: (selected: FundsTransaction[]) => void;
	onOffsetChange: (offset: number) => void;
	onInspectEdge: (id: string) => void;
}) {
	return (
		<TabsContent
			value="transactions"
			className="flex min-h-0 flex-col gap-workspace-gutter overflow-hidden"
		>
			<ScrollArea
				className="max-h-1/3 shrink-0 overscroll-contain"
				contentClassName="space-y-4"
			>
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-1">
						<h3 className="font-medium text-sm">
							{flow
								? "流向包含的交易"
								: showingFlows
									? "资金流向汇总"
									: hasTraced
										? "追踪结果明细"
										: "交易明细"}{" "}
							<span className="text-muted-foreground">
								{total.toLocaleString("zh-CN")} {showingFlows ? "条流向" : "笔"}
							</span>
						</h3>
						{hasTraced && (
							<HelpTip
								label="追踪结果明细说明"
								content="这里列出画布中全部追踪交易，包含展开后的后续交易；同一笔交易只列一次，可逐条核对来源。"
							/>
						)}
					</div>
					{flow && (
						<Button variant="outline" onClick={onCloseFlow}>
							返回流向汇总
						</Button>
					)}
					{selected.length > 0 && (
						<Button variant="ghost" onClick={() => onSelectionChange([])}>
							清空选择
						</Button>
					)}
					<GraphToolbarContext value={TRANSACTIONS_TOOLBAR_CONTEXT}>
						<fieldset
							className="ml-auto flex shrink-0 items-center gap-1"
							aria-label="银行流水筛选工具"
						>
							{filterToolbar}
						</fieldset>
					</GraphToolbarContext>
				</div>
				{flow && (
					<p className="text-sm">
						{accountName(lookup.get(flow.from))} →{" "}
						{accountName(lookup.get(flow.to))} ·{" "}
						{formatFunds(flow.amountMinor, flow.currency)} · {flow.count} 笔
						{flow.from === flow.to ? " · 主体内部划转" : ""}
					</p>
				)}
			</ScrollArea>
			{showingFlows ? (
				<FlowTable
					key={`${frameId}:${flowId}:${offset}`}
					edges={flowEdges}
					nodes={lookup}
					onOpen={onOpenFlow}
				/>
			) : (
				<div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
					<Table
						key={`${frameId}:${flowId}:${offset}`}
						containerProps={{
							className: "h-full",
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
							{transactionEdges.map((t) => (
								<TableRow key={t.id}>
									<TableCell>
										<Checkbox
											aria-label={`选择 ${t.timestamp.slice(0, 19)} ${formatFunds(t.amountMinor, t.currency)} 交易`}
											checked={selected.some((item) => item.id === t.id)}
											onCheckedChange={(checked) =>
												onSelectionChange(
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
											onClick={() => onInspectEdge(t.id)}
										>
											核对 {t.evidenceIds.length} 条
										</Button>
									</TableCell>
								</TableRow>
							))}
							{transactionEdges.length === 0 && (
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
					{total
						? `${offset + 1}–${Math.min(offset + 50, total)} / ${total}`
						: "0 条"}{" "}
					· 时间采用银行本地时间（UTC+8）
				</span>
				<div className="flex gap-2">
					<Button
						variant="outline"
						disabled={!offset || (!hasTraced && loading)}
						onClick={() => onOffsetChange(Math.max(0, offset - 50))}
					>
						上一页
					</Button>
					<Button
						variant="outline"
						disabled={offset + 50 >= total || (!hasTraced && loading)}
						onClick={() => onOffsetChange(offset + 50)}
					>
						下一页
					</Button>
				</div>
			</div>
		</TabsContent>
	);
}
