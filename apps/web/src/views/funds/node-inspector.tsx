/**
 * @file 统一详情侧栏中的节点详情与标记内容。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：查看节点不改变当前分析范围，显式下钻才更新画布。
 * 被调用：GraphInspector；调用：Sheet 标题、CopyText、标记编辑器、整案统计。
 * 功能：显示账户归属、数据覆盖、整案收付与内部划转；支持标记与隐藏。
 * 预期结果：只更新节点内容，不重建外层侧栏；编辑状态不串到其他节点。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import {
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@leonwillow-electron/ui/components/sheet";
import { ArrowDownToLineIcon, EyeOffIcon, PaintbrushIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { accountName, type FundsAccount, formatFunds } from "@/lib/funds";
import type { NodeMode, RawGraph } from "@/lib/funds-analysis";
import {
	type NodeMark,
	type NodePresentation,
	summarizeNode,
} from "@/lib/funds-graph-presentation";
import NodeMarkEditor from "./node-mark-editor";
import NodeStatusTags from "./node-status-tags";

/** 新标记从当前主题读取默认色，避免换主题后套用固定配色。 */
function initialMark(node: FundsAccount): NodeMark {
	const css = getComputedStyle(document.documentElement);
	const color = (token: string) => css.getPropertyValue(token).trim();
	return {
		shape: "circle",
		size: 100,
		fill: color(node.hasStatement ? "--primary" : "--background"),
		stroke: color(node.hasStatement ? "--primary" : "--muted-foreground"),
		borderWidth: 1.5,
		borderDash: node.hasStatement ? "solid" : "dashed",
		edgeColor: color("--primary"),
		edgeWidth: 2,
		edgeDash: "solid",
		edgeScope: "both",
	};
}

export default function NodeInspector({
	node,
	mode,
	full,
	presentation,
	tab,
	onTabChange,
	onDrill,
	onHide,
	onMark,
	onReset,
}: {
	node: FundsAccount;
	mode: NodeMode;
	full: RawGraph;
	presentation?: NodePresentation;
	tab: "details" | "mark";
	onTabChange: (tab: "details" | "mark") => void;
	onDrill: () => void;
	onHide: () => void;
	onMark: (mark: NodeMark) => void;
	onReset: () => void;
}) {
	const name = accountName(node);
	const summary = useMemo(() => summarizeNode(full, node.id), [full, node.id]);
	const [defaults] = useState(() => initialMark(node));
	return (
		<>
			<SheetHeader className="h-workspace-header shrink-0 justify-center gap-0 border-b py-0 pr-12">
				<SheetTitle
					className="flex min-w-0 items-center gap-1"
					aria-label={tab === "mark" ? `特殊标记 · ${name}` : name}
				>
					{tab === "mark" && <span className="shrink-0">特殊标记 ·</span>}
					<CopyText value={name} className="min-w-0 truncate" />
				</SheetTitle>
				<SheetDescription className="min-w-0 truncate">
					{mode === "subject" ? (
						`主体 · ${node.accountNumbers.length} 个账户`
					) : node.unknown ? (
						"账号待核"
					) : (
						<CopyText
							value={node.number}
							className="block truncate font-mono"
						/>
					)}
				</SheetDescription>
			</SheetHeader>
			<div className="min-h-0 flex-1 overflow-y-auto p-4">
				{tab === "mark" ? (
					<NodeMarkEditor
						initial={
							presentation?.marked && presentation.mark
								? presentation.mark
								: defaults
						}
						onSave={(mark) => {
							onMark(mark);
							onTabChange("details");
						}}
						onReset={() => {
							onReset();
							onTabChange("details");
						}}
						onCancel={() => onTabChange("details")}
					/>
				) : (
					<div className="flex flex-col gap-5">
						<NodeStatusTags node={node} presentation={presentation} />
						<div className="flex flex-wrap gap-2">
							<Button onClick={onDrill}>
								<ArrowDownToLineIcon data-icon="inline-start" />
								下钻分析
							</Button>
							<Button variant="outline" onClick={() => onTabChange("mark")}>
								<PaintbrushIcon data-icon="inline-start" />
								特殊标记
							</Button>
							<Button variant="ghost" onClick={onHide}>
								<EyeOffIcon data-icon="inline-start" />
								{presentation?.hidden ? "恢复显示" : "隐藏节点"}
							</Button>
						</div>
						<section className="flex flex-col gap-3" aria-label="节点资金概况">
							<h3 className="font-medium text-sm">本案资金概况</h3>
							<dl className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<dt className="text-muted-foreground text-xs">交易笔数</dt>
									<dd className="mt-1 tabular-nums">
										{summary.count.toLocaleString("zh-CN")} 笔
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground text-xs">交易对手</dt>
									<dd className="mt-1 tabular-nums">
										{summary.peers} 个{mode === "subject" ? "主体" : "账户"}
									</dd>
								</div>
							</dl>
							{summary.currencies.map((row) => (
								<dl
									key={row.currency}
									className="flex flex-col gap-2 border-t pt-3 text-xs"
								>
									<div className="flex justify-between gap-2">
										<dt className="text-muted-foreground">
											流入 · {row.inCount} 笔
										</dt>
										<dd className="text-right tabular-nums">
											<CopyText
												value={formatFunds(
													row.incoming.toString(),
													row.currency,
												)}
												className="text-right"
											/>
										</dd>
									</div>
									<div className="flex justify-between gap-2">
										<dt className="text-muted-foreground">
											流出 · {row.outCount} 笔
										</dt>
										<dd className="text-right tabular-nums">
											<CopyText
												value={formatFunds(
													row.outgoing.toString(),
													row.currency,
												)}
												className="text-right"
											/>
										</dd>
									</div>
									<div className="flex justify-between gap-2">
										<dt className="text-muted-foreground">
											差额（流入－流出）
										</dt>
										<dd className="text-right tabular-nums">
											<CopyText
												value={formatFunds(
													(row.incoming - row.outgoing).toString(),
													row.currency,
												)}
												className="text-right"
											/>
										</dd>
									</div>
									{row.internalCount > 0 && (
										<div className="flex justify-between gap-2">
											<dt className="text-muted-foreground">
												内部划转 · {row.internalCount} 笔
											</dt>
											<dd className="text-right tabular-nums">
												<CopyText
													value={formatFunds(
														row.internal.toString(),
														row.currency,
													)}
													className="text-right"
												/>
											</dd>
										</div>
									)}
								</dl>
							))}
							<p className="text-muted-foreground text-xs">
								交易区间：
								{summary.first
									? `${summary.first.slice(0, 10)} 至 ${summary.last.slice(0, 10)}`
									: "暂无交易"}
							</p>
						</section>
						<section className="flex flex-col gap-3 border-t pt-4">
							<h3 className="font-medium text-sm">
								{mode === "subject" ? "包含账户与归属依据" : "账户信息"}
							</h3>
							<p className="text-muted-foreground text-xs">{node.basis}</p>
							{node.accounts.map((a) => (
								<div key={a.id} className="flex flex-col gap-1 text-xs">
									<p className="break-all font-mono">
										{a.unknown ? "账号待核" : <CopyText value={a.number} />}
									</p>
									<p className="break-words">
										<CopyText
											value={
												(a.ownNames.length ? a.ownNames : a.names).join(
													" / ",
												) || "户名待核"
											}
										/>
									</p>
									<p className="text-muted-foreground">
										{a.hasStatement
											? "已有本方流水"
											: "仅见对手 · 可继续调取流水"}
									</p>
								</div>
							))}
						</section>
					</div>
				)}
			</div>
		</>
	);
}
