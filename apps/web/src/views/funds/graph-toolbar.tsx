/**
 * @file 图谱菜单栏、节点筛选和连线筛选。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：复用原模板 FilterSelect 与共享 Popover，草稿提交后才改变视图。
 * 被调用：analysis-panel；调用：共享 UI、图谱筛选校验。
 * 预期结果：以紧凑图标扩展 G6 悬浮工具栏，悬停有中文提示，筛选草稿按需展开。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CircleDotIcon,
	ListFilterIcon,
	RotateCcwIcon,
} from "lucide-react";
import { useContext, useEffect, useId, useState } from "react";
import type { EdgeMode } from "@/lib/funds-analysis";
import {
	type EdgeFilter,
	edgeFilterError,
	emptyEdgeFilter,
	emptyNodeFilter,
	hasEdgeFilter,
	hasNodeFilter,
	type NodeFilter,
} from "@/lib/funds-graph-filters";

import FilterSelect from "./filter-select";
import { GraphToolbarContext } from "./graph-toolbar-context";

export type RelationFilter = {
	from: string;
	to: string;
	counterparty: string;
	direction: "both" | "in" | "out";
};
export const emptyRelationFilter: RelationFilter = {
	from: "",
	to: "",
	counterparty: "",
	direction: "both",
};

export default function GraphToolbar({
	nodes,
	edges,
	relation,
	edgeMode,
	hasAccount,
	currencies,
	canBack,
	canForward,
	onBack,
	onForward,
	onNodes,
	onEdges,
	onClear,
}: {
	nodes: NodeFilter;
	edges: EdgeFilter;
	relation: RelationFilter;
	edgeMode: EdgeMode;
	hasAccount: boolean;
	currencies: string[];
	canBack: boolean;
	canForward: boolean;
	onBack: () => void;
	onForward: () => void;
	onNodes: (value: NodeFilter) => void;
	onEdges: (value: EdgeFilter, relation: RelationFilter) => void;
	onClear: () => void;
}) {
	const id = useId();
	const { side, onPopupChange } = useContext(GraphToolbarContext);
	const [nodeOpen, setNodeOpen] = useState(false);
	const [edgeOpen, setEdgeOpen] = useState(false);
	useEffect(() => {
		onPopupChange("filters", nodeOpen || edgeOpen);
		return () => onPopupChange("filters", false);
	}, [nodeOpen, edgeOpen, onPopupChange]);
	const [nodeDraft, setNodeDraft] = useState(nodes);
	const [edgeDraft, setEdgeDraft] = useState(edges);
	const [rangeDraft, setRangeDraft] = useState(relation);
	const nodeActive = hasNodeFilter(nodes);
	const edgeActive =
		hasEdgeFilter(edges, edgeMode) ||
		!!(
			relation.from ||
			relation.to ||
			relation.counterparty ||
			(hasAccount && relation.direction !== "both")
		);
	const error =
		edgeFilterError(edgeDraft, edgeMode) ||
		(rangeDraft.from && rangeDraft.to && rangeDraft.from > rangeDraft.to
			? "结束日期不能早于开始日期。"
			: "");
	return (
		<>
			<fieldset className="flex items-center gap-0.5" aria-label="视图历史">
				{[
					{
						label: "上一步",
						tip: "返回之前的图谱视图",
						disabled: !canBack,
						onClick: onBack,
						Icon: ArrowLeftIcon,
					},
					{
						label: "下一步",
						tip: "前进到下一图谱视图",
						disabled: !canForward,
						onClick: onForward,
						Icon: ArrowRightIcon,
					},
				].map(({ label, tip, disabled, onClick, Icon }) => (
					<Tooltip key={label}>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									size="icon"
									disabled={disabled}
									onClick={onClick}
									aria-label={label}
								/>
							}
						>
							<Icon />
						</TooltipTrigger>
						<TooltipContent>{tip}</TooltipContent>
					</Tooltip>
				))}
			</fieldset>
			<div className="funds-graph-toolbar-separator" aria-hidden="true" />
			<Popover
				open={nodeOpen}
				onOpenChange={(open) => {
					if (open) setNodeDraft(nodes);
					setNodeOpen(open);
				}}
			>
				<Tooltip>
					<TooltipTrigger
						render={
							<PopoverTrigger
								render={
									<Button
										size="icon"
										variant={nodeActive ? "secondary" : "ghost"}
										aria-label="节点筛选"
										className={nodeActive ? "text-primary" : undefined}
									/>
								}
							/>
						}
					>
						<CircleDotIcon />
					</TooltipTrigger>
					<TooltipContent>节点筛选{nodeActive && "（已启用）"}</TooltipContent>
				</Tooltip>
				<PopoverContent
					side={side}
					sideOffset={10}
					align="start"
					className="max-h-[min(38rem,80dvh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-4"
				>
					<PopoverHeader>
						<PopoverTitle>筛选节点</PopoverTitle>
						<PopoverDescription>在当前分析范围内查找节点。</PopoverDescription>
					</PopoverHeader>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							onNodes({ ...nodeDraft, query: nodeDraft.query.trim() });
							setNodeOpen(false);
						}}
					>
						<div className="space-y-1.5">
							<Label htmlFor={`${id}-query`}>姓名或账号</Label>
							<Input
								id={`${id}-query`}
								placeholder="支持姓名、账号片段"
								value={nodeDraft.query}
								onChange={(e) =>
									setNodeDraft({ ...nodeDraft, query: e.target.value })
								}
							/>
						</div>
						<FilterSelect
							label="流水资料"
							value={nodeDraft.coverage}
							options={[
								{ value: "all", label: "全部节点" },
								{ value: "statement", label: "已取得本方流水" },
								{ value: "counterparty", label: "仅见交易对手" },
							]}
							onChange={(v) =>
								setNodeDraft({
									...nodeDraft,
									coverage: v as NodeFilter["coverage"],
								})
							}
						/>
						<FilterSelect
							label="特殊标记"
							value={nodeDraft.mark}
							options={[
								{ value: "all", label: "全部" },
								{ value: "marked", label: "已标记" },
								{ value: "unmarked", label: "未标记" },
							]}
							onChange={(v) =>
								setNodeDraft({ ...nodeDraft, mark: v as NodeFilter["mark"] })
							}
						/>
						<FilterSelect
							label="保留范围"
							value={nodeDraft.scope}
							options={[
								{ value: "neighbors", label: "匹配节点及其直接往来对手" },
								{ value: "matched", label: "仅匹配节点之间的交易" },
							]}
							onChange={(v) =>
								setNodeDraft({ ...nodeDraft, scope: v as NodeFilter["scope"] })
							}
						/>
						<p className="text-muted-foreground text-xs">
							多项条件同时满足；默认保留往来对手，便于查看资金进出。
						</p>
						<div className="flex justify-between gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									onNodes(emptyNodeFilter);
									setNodeOpen(false);
								}}
							>
								清空节点筛选
							</Button>
							<Button type="submit">应用节点筛选</Button>
						</div>
					</form>
				</PopoverContent>
			</Popover>
			<Popover
				open={edgeOpen}
				onOpenChange={(open) => {
					if (open) {
						setEdgeDraft(edges);
						setRangeDraft(relation);
					}
					setEdgeOpen(open);
				}}
			>
				<Tooltip>
					<TooltipTrigger
						render={
							<PopoverTrigger
								render={
									<Button
										size="icon"
										variant={edgeActive ? "secondary" : "ghost"}
										aria-label="连线筛选"
										className={edgeActive ? "text-primary" : undefined}
									/>
								}
							/>
						}
					>
						<ListFilterIcon />
					</TooltipTrigger>
					<TooltipContent>连线筛选{edgeActive && "（已启用）"}</TooltipContent>
				</Tooltip>
				<PopoverContent
					side={side}
					sideOffset={10}
					align="start"
					className="max-h-[min(42rem,80dvh)] w-[28rem] max-w-[calc(100vw-2rem)] overflow-y-auto p-4"
				>
					<PopoverHeader>
						<PopoverTitle>筛选连线</PopoverTitle>
						<PopoverDescription>
							{edgeMode === "flow"
								? "金额与笔数按每条有向汇总流向判断。"
								: "金额按每笔交易判断。"}
							图和明细同步筛选。
						</PopoverDescription>
					</PopoverHeader>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							if (error) return;
							onEdges(edgeDraft, {
								...rangeDraft,
								counterparty: rangeDraft.counterparty.trim(),
							});
							setEdgeOpen(false);
						}}
					>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor={`${id}-from`}>开始日期</Label>
								<Input
									id={`${id}-from`}
									type="date"
									value={rangeDraft.from}
									onChange={(e) =>
										setRangeDraft({ ...rangeDraft, from: e.target.value })
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor={`${id}-to`}>结束日期</Label>
								<Input
									id={`${id}-to`}
									type="date"
									min={rangeDraft.from}
									value={rangeDraft.to}
									onChange={(e) =>
										setRangeDraft({ ...rangeDraft, to: e.target.value })
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor={`${id}-min`}>最低金额（元）</Label>
								<Input
									id={`${id}-min`}
									inputMode="decimal"
									placeholder="不限"
									value={edgeDraft.minAmount}
									onChange={(e) =>
										setEdgeDraft({
											...edgeDraft,
											minAmount: e.target.value.trim(),
										})
									}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor={`${id}-max`}>最高金额（元）</Label>
								<Input
									id={`${id}-max`}
									inputMode="decimal"
									placeholder="不限"
									value={edgeDraft.maxAmount}
									onChange={(e) =>
										setEdgeDraft({
											...edgeDraft,
											maxAmount: e.target.value.trim(),
										})
									}
								/>
							</div>
						</div>
						{currencies.length > 1 && (
							<FilterSelect
								label="币种"
								value={edgeDraft.currency}
								options={[
									{ value: "", label: "全部（按各自币种金额，不换汇）" },
									...currencies.map((c) => ({ value: c, label: c })),
								]}
								onChange={(v) => setEdgeDraft({ ...edgeDraft, currency: v })}
							/>
						)}
						{edgeMode === "flow" && (
							<div className="space-y-1.5">
								<Label htmlFor={`${id}-count`}>每条流向最低交易笔数</Label>
								<Input
									id={`${id}-count`}
									inputMode="numeric"
									placeholder="不限"
									value={edgeDraft.minCount}
									onChange={(e) =>
										setEdgeDraft({
											...edgeDraft,
											minCount: e.target.value.trim(),
										})
									}
								/>
							</div>
						)}
						<div className="space-y-1.5">
							<Label htmlFor={`${id}-peer`}>指定交易对手账号</Label>
							<Input
								id={`${id}-peer`}
								placeholder="可选，输入完整账号"
								value={rangeDraft.counterparty}
								onChange={(e) =>
									setRangeDraft({ ...rangeDraft, counterparty: e.target.value })
								}
							/>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<FilterSelect
								label="所选节点方向"
								disabled={!hasAccount}
								value={rangeDraft.direction}
								options={[
									{ value: "both", label: "收入和支出" },
									{ value: "out", label: "支出" },
									{ value: "in", label: "收入" },
								]}
								onChange={(v) =>
									setRangeDraft({
										...rangeDraft,
										direction: v as RelationFilter["direction"],
									})
								}
							/>
							<FilterSelect
								label="节点内部划转"
								value={edgeDraft.internal}
								options={[
									{ value: "all", label: "全部" },
									{ value: "exclude", label: "排除内部划转" },
									{ value: "only", label: "仅内部划转" },
								]}
								onChange={(v) =>
									setEdgeDraft({
										...edgeDraft,
										internal: v as EdgeFilter["internal"],
									})
								}
							/>
						</div>
						<p className="text-muted-foreground text-xs">
							日期先筛选再汇总；内部划转指同一展示节点内的交易。下钻节点后可指定收支方向。
						</p>
						{error && (
							<p role="alert" className="text-destructive text-xs">
								{error}
							</p>
						)}
						<div className="flex justify-between gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									onEdges(emptyEdgeFilter, emptyRelationFilter);
									setEdgeOpen(false);
								}}
							>
								清空连线筛选
							</Button>
							<Button type="submit" disabled={!!error}>
								应用连线筛选
							</Button>
						</div>
					</form>
				</PopoverContent>
			</Popover>
			{(nodeActive || edgeActive) && (
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon"
								aria-label="清空图谱筛选"
								onClick={onClear}
							/>
						}
					>
						<RotateCcwIcon />
					</TooltipTrigger>
					<TooltipContent>清空图谱筛选，保留下钻节点</TooltipContent>
				</Tooltip>
			)}
		</>
	);
}
