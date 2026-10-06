/**
 * @file 资金账户/主体目录与悬停速览。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：列表保持两行，悬停预览已加载数据，点击查看完整详情。
 * 被调用：AccountDirectory；调用：共享 HoverCard、NodeStatusTags、summarizeNode。
 * 功能：名称与笔数单行显示；预览按需计算本案收付、对手与交易区间。
 * 预期结果：悬停不发起网络请求，不加载全部账户的预览统计；点击关闭预览。
 */
import {
	type createHoverCardHandle,
	HoverCardTrigger,
} from "@leonwillow-electron/ui/components/hover-card";
import { Separator } from "@leonwillow-electron/ui/components/separator";
import { type ComponentProps, useMemo } from "react";
import { accountName, type FundsAccount, formatFunds } from "@/lib/funds";
import type { NodeMode, RawGraph } from "@/lib/funds-analysis";
import {
	type NodePresentation,
	summarizeNode,
} from "@/lib/funds-graph-presentation";
import NodeStatusTags from "./node-status-tags";

type PreviewProps = {
	node: FundsAccount;
	mode: NodeMode;
	full: RawGraph;
	presentation?: NodePresentation;
};

/** 仅在预览打开时挂载；统计来源与详情一致，按币种分别展示，不抵销往返金额。 */
export function AccountPreview({
	node,
	mode,
	full,
	presentation,
}: PreviewProps) {
	const summary = useMemo(() => summarizeNode(full, node.id), [full, node.id]);
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1">
				<h3 className="break-words font-medium text-sm">{accountName(node)}</h3>
				<p className="break-all text-muted-foreground">
					{mode === "subject"
						? `${node.accountNumbers.length} 个账户`
						: node.number}
				</p>
			</div>
			<NodeStatusTags node={node} presentation={presentation} />
			<Separator />
			<dl className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between gap-2">
					<dt className="text-muted-foreground">本案交易</dt>
					<dd className="text-right tabular-nums">
						{summary.count.toLocaleString("zh-CN")} 笔 · {summary.peers} 个对手
					</dd>
				</div>
				{summary.currencies.map((row) => (
					<div key={row.currency} className="flex flex-col gap-2">
						<div className="flex items-baseline justify-between gap-2">
							<dt className="shrink-0 text-muted-foreground">流入</dt>
							<dd className="break-all text-right tabular-nums">
								{formatFunds(row.incoming.toString(), row.currency)}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-2">
							<dt className="shrink-0 text-muted-foreground">流出</dt>
							<dd className="break-all text-right tabular-nums">
								{formatFunds(row.outgoing.toString(), row.currency)}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-2">
							<dt className="shrink-0 text-muted-foreground">
								差额（流入－流出）
							</dt>
							<dd className="break-all text-right tabular-nums">
								{formatFunds(
									(row.incoming - row.outgoing).toString(),
									row.currency,
								)}
							</dd>
						</div>
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

export default function AccountDirectoryRow({
	node,
	mode,
	handle,
	onPreviewActivate,
	onPreviewDismiss,
	transactionCount,
	onClick,
	onContextMenu,
	onKeyDown,
	onMouseEnter,
	onFocus,
	...buttonProps
}: Omit<ComponentProps<"button">, "children"> & {
	node: FundsAccount;
	mode: NodeMode;
	handle: ReturnType<typeof createHoverCardHandle<FundsAccount>>;
	onPreviewActivate: (id: string) => void;
	onPreviewDismiss: () => void;
	transactionCount: number;
}) {
	return (
		<HoverCardTrigger
			handle={handle}
			payload={node}
			delay={100}
			closeDelay={150}
			render={
				<button
					type="button"
					{...buttonProps}
					data-preview-account={node.id}
					onMouseEnter={(event) => {
						onPreviewActivate(node.id);
						onMouseEnter?.(event);
					}}
					onFocus={(event) => {
						onPreviewActivate(node.id);
						onFocus?.(event);
					}}
					onClick={(event) => {
						onPreviewDismiss();
						onClick?.(event);
					}}
					onContextMenu={(event) => {
						onPreviewDismiss();
						onContextMenu?.(event);
					}}
					onKeyDown={(event) => {
						if (
							event.key === "ContextMenu" ||
							(event.shiftKey && event.key === "F10")
						)
							onPreviewDismiss();
						onKeyDown?.(event);
					}}
				>
					<span className="flex w-full min-w-0 items-center gap-2">
						<span className="min-w-0 flex-1 truncate font-medium">
							{accountName(node)}
						</span>
						<span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
							{transactionCount} 笔
						</span>
					</span>
					<span className="break-all font-mono text-muted-foreground">
						{mode === "subject"
							? `${node.accountNumbers.length} 个账户`
							: node.number}
					</span>
				</button>
			}
		/>
	);
}
