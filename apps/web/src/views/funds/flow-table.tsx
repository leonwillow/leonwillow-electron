/**
 * @file 有向资金汇总表及逐笔下钻入口。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：同一方向与币种展示总额、笔数及时间区间。
 * 被调用：analysis-panel；调用：共享 Table/Button 与金额显示函数。
 * 预期结果：往返分开，内部划转明确，点击展开真实交易而非伪造证据 ID。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import { accountName, type FundsAccount, formatFunds } from "@/lib/funds";
import type { AnalysisEdge } from "@/lib/funds-analysis";
export default function FlowTable({
	edges,
	nodes,
	onOpen,
}: {
	edges: AnalysisEdge[];
	nodes: Map<string, FundsAccount>;
	onOpen: (id: string) => void;
}) {
	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>付款方 → 收款方</TableHead>
						<TableHead className="text-right">合计金额</TableHead>
						<TableHead className="text-right">笔数</TableHead>
						<TableHead>交易区间</TableHead>
						<TableHead>明细</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{edges.map((t) => (
						<TableRow key={t.id}>
							<TableCell className="text-xs">
								<p>
									{accountName(nodes.get(t.from))} →{" "}
									{accountName(nodes.get(t.to))}
								</p>
								<p className="mt-1 text-muted-foreground">
									{t.from === t.to
										? "内部划转"
										: `${nodeCaption(nodes.get(t.from))} → ${nodeCaption(nodes.get(t.to))}`}
								</p>
							</TableCell>
							<TableCell className="text-right font-medium tabular-nums">
								{formatFunds(t.amountMinor, t.currency)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{t.count}
							</TableCell>
							<TableCell className="text-xs tabular-nums">
								{t.timestamp.slice(0, 10)}
								<br />至 {t.lastTimestamp.slice(0, 10)}
							</TableCell>
							<TableCell>
								<Button
									size="sm"
									variant="ghost"
									aria-label={`展开 ${accountName(nodes.get(t.from))} 向 ${accountName(nodes.get(t.to))} 的 ${t.count} 笔交易`}
									onClick={() => onOpen(t.id)}
								>
									展开交易
								</Button>
							</TableCell>
						</TableRow>
					))}
					{!edges.length && (
						<TableRow>
							<TableCell
								colSpan={5}
								className="py-8 text-center text-muted-foreground"
							>
								当前条件没有资金流向。
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
const nodeCaption = (node?: FundsAccount) =>
	node && node.accountNumbers.length > 1
		? `${node.accountNumbers.length} 个账户`
		: node?.number
			? `尾号 ${node.number.slice(-4)}`
			: "账号待核";
