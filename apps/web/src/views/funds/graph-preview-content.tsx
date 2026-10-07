/**
 * @file 画布节点与连线的轻量速览正文。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：只呈现内存摘要，复用复制与语义标签，不读取交易证据。
 * 被调用：GraphHoverPreview；调用：CopyText、NodeStatusTags、金额格式化。
 * 预期结果：明确当前视图口径，汇总流向保持方向，内部划转与币种不混加。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import { Separator } from "@leonwillow-electron/ui/components/separator";
import type { ReactNode } from "react";
import { accountName, type FundsAccount, formatFunds } from "@/lib/funds";
import type { NodeMode } from "@/lib/funds-analysis";
import type { GraphPresentation } from "@/lib/funds-graph-presentation";
import type { GraphPreview } from "@/lib/funds-graph-preview";
import NodeStatusTags from "./node-status-tags";

function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-all text-right tabular-nums">{children}</dd>
		</div>
	);
}
function Money({
	label,
	amount,
	currency,
}: {
	label: string;
	amount: bigint | string;
	currency: string;
}) {
	return (
		<Fact label={label}>
			<CopyText
				className="text-right"
				value={formatFunds(amount.toString(), currency)}
			/>
		</Fact>
	);
}
function Account({
	node,
	number,
	mode,
}: {
	node?: FundsAccount;
	number?: string;
	mode: NodeMode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p className="truncate font-medium text-sm">
				<CopyText value={accountName(node)} className="block truncate" />
			</p>
			<p className="break-all text-muted-foreground">
				{node?.unknown ? (
					"账号待核"
				) : number ? (
					<CopyText value={number} />
				) : mode === "subject" ? (
					`${node?.accountNumbers.length ?? 0} 个账户`
				) : (
					<CopyText value={node?.number ?? "账号待核"} />
				)}
			</p>
		</div>
	);
}

export default function GraphPreviewContent({
	preview,
	mode,
	presentation,
}: {
	preview: GraphPreview;
	mode: NodeMode;
	presentation: GraphPresentation;
}) {
	if (preview.kind === "node") {
		const { node, summary } = preview;
		return (
			<div className="flex flex-col gap-3">
				<Account node={node} mode={mode} />
				<NodeStatusTags node={node} presentation={presentation[node.id]} />
				<Separator />
				<dl className="flex flex-col gap-2">
					<Fact label="当前视图">
						{summary.count.toLocaleString("zh-CN")} 笔 · {summary.peers} 个对手
					</Fact>
					{summary.currencies.map((row) => (
						<div key={row.currency} className="flex flex-col gap-2">
							<Money
								label="流入"
								amount={row.incoming}
								currency={row.currency}
							/>
							<Money
								label="流出"
								amount={row.outgoing}
								currency={row.currency}
							/>
							<Money
								label="差额"
								amount={row.incoming - row.outgoing}
								currency={row.currency}
							/>
							{row.internalCount > 0 && (
								<Money
									label={`内部划转 · ${row.internalCount} 笔`}
									amount={row.internal}
									currency={row.currency}
								/>
							)}
						</div>
					))}
				</dl>
				{summary.first && (
					<p className="text-muted-foreground tabular-nums">
						{summary.first.slice(0, 10)} 至 {summary.last.slice(0, 10)}
					</p>
				)}
			</div>
		);
	}
	const { edge, from, to } = preview;
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-1">
				<Badge variant="secondary">
					{edge.aggregated ? "汇总流向" : "逐笔交易"}
				</Badge>
				{edge.from === edge.to && <Badge variant="secondary">内部划转</Badge>}
			</div>
			<div className="flex flex-col gap-1">
				<p className="text-muted-foreground">付款方</p>
				<Account
					node={from}
					number={!edge.aggregated ? edge.fromAccount : undefined}
					mode={mode}
				/>
			</div>
			<div className="flex flex-col gap-1">
				<p className="text-muted-foreground">收款方</p>
				<Account
					node={to}
					number={!edge.aggregated ? edge.toAccount : undefined}
					mode={mode}
				/>
			</div>
			<Separator />
			<dl className="flex flex-col gap-2">
				<Money
					label={edge.aggregated ? "单向合计" : "金额"}
					amount={edge.amountMinor}
					currency={edge.currency}
				/>
				<Fact label="交易笔数">{edge.count.toLocaleString("zh-CN")} 笔</Fact>
			</dl>
			<p className="text-muted-foreground tabular-nums">
				{edge.aggregated
					? `${edge.timestamp.slice(0, 10)} 至 ${edge.lastTimestamp.slice(0, 10)}`
					: edge.timestamp.replace("T", " ").slice(0, 19)}
			</p>
			{!edge.aggregated && edge.summary && (
				<p className="break-words text-muted-foreground">{edge.summary}</p>
			)}
		</div>
	);
}
