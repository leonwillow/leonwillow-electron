/**
 * @file 统一详情侧栏中的逐笔交易与有向汇总内容。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：复用已加载的连线基础信息；只有选中逐笔交易才读取其来源证据。
 * 被调用：GraphInspector；调用：GraphPreviewContent、EvidenceContent、共享 Sheet 标题。
 * 功能：双方、金额、时间、核对状态和来源；汇总用本地交易列表分页。
 * 预期结果：汇总不冒用第一笔交易的证据或状态，切换交易后旧请求不覆盖新对象。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import {
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@leonwillow-electron/ui/components/sheet";
import { useMemo, useState } from "react";
import { accountName, formatFunds } from "@/lib/funds";
import type { AnalysisEdge, NodeMode, RawGraph } from "@/lib/funds-analysis";
import { EvidenceContent } from "./evidence-dialog";
import GraphPreviewContent from "./graph-preview-content";

export default function EdgeInspector({
	edge,
	caseId,
	mode,
	full,
	onEdge,
}: {
	edge: AnalysisEdge;
	caseId: string;
	mode: NodeMode;
	full: RawGraph;
	onEdge: (id: string) => void;
}) {
	const from = full.nodes.find((node) => node.id === edge.from);
	const to = full.nodes.find((node) => node.id === edge.to);
	const name = `${accountName(from)} → ${accountName(to)}`;
	const target = useMemo(() => ({ transactionId: edge.id }), [edge.id]);
	const [offset, setOffset] = useState(0);
	const transactions = useMemo(() => {
		if (!edge.aggregated) return [];
		const ids = new Set(edge.transactionIds);
		return full.edges.filter((transaction) => ids.has(transaction.id));
	}, [edge, full.edges]);
	return (
		<>
			<SheetHeader className="h-workspace-header shrink-0 justify-center gap-0 border-b py-0 pr-12">
				<SheetTitle className="flex min-w-0 items-center" aria-label={name}>
					<CopyText value={name} className="min-w-0 truncate" />
				</SheetTitle>
				<SheetDescription>
					{edge.aggregated
						? `汇总流向 · ${edge.count.toLocaleString("zh-CN")} 笔交易`
						: "逐笔交易"}
				</SheetDescription>
			</SheetHeader>
			<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 text-xs">
				<GraphPreviewContent
					preview={{ kind: "edge", edge, from, to }}
					mode={mode}
					presentation={{}}
				/>
				{edge.aggregated ? (
					<section
						className="flex flex-col gap-3 border-t pt-4"
						aria-label="流向包含的交易"
					>
						<h3 className="font-medium text-sm">包含的交易</h3>
						<ul className="divide-y">
							{transactions.slice(offset, offset + 20).map((transaction) => (
								<li
									key={transaction.id}
									className="flex items-center gap-2 py-3"
								>
									<div className="flex min-w-0 flex-1 flex-col gap-1 tabular-nums">
										<CopyText
											value={formatFunds(
												transaction.amountMinor,
												transaction.currency,
											)}
										/>
										<span className="text-muted-foreground">
											{transaction.timestamp.replace("T", " ").slice(0, 19)}
										</span>
									</div>
									<Button
										size="sm"
										variant="outline"
										aria-label={`查看 ${transaction.timestamp.replace("T", " ").slice(0, 19)} ${formatFunds(transaction.amountMinor, transaction.currency)} 交易详情`}
										onClick={() => onEdge(transaction.id)}
									>
										查看详情
									</Button>
								</li>
							))}
						</ul>
						{transactions.length > 20 && (
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-muted-foreground tabular-nums">
									{offset + 1}–{Math.min(offset + 20, transactions.length)} /{" "}
									{transactions.length}
								</span>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										disabled={offset === 0}
										onClick={() => setOffset(Math.max(0, offset - 20))}
									>
										上一页
									</Button>
									<Button
										size="sm"
										variant="outline"
										disabled={offset + 20 >= transactions.length}
										onClick={() => setOffset(offset + 20)}
									>
										下一页
									</Button>
								</div>
							</div>
						)}
					</section>
				) : (
					<section
						className="flex flex-col gap-3 border-t pt-4"
						aria-label="交易来源核对"
					>
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<h3 className="font-medium text-sm">来源核对</h3>
							<span className="text-muted-foreground">
								{edge.reconciliation === "single"
									? "单边记录"
									: edge.reconciliation === "mirror"
										? "双边一致"
										: "人工核对"}
							</span>
						</div>
						<EvidenceContent key={edge.id} caseId={caseId} target={target} />
					</section>
				)}
			</div>
		</>
	);
}
