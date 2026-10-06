/**
 * @file 交易证据与异常原文的核对弹窗。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：显示全部来源证据，不覆盖原始字段。
 * 被调用：分析/核对面板；调用：Eden 和共享 Dialog。
 * 预期结果：可定位文件、表、行、哈希，加载/失败均可关闭。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { useCallback } from "react";
import { formatFunds, getFundsEvidence, getFundsRow } from "@/lib/funds";
import { useFundsResource } from "./use-funds-resource";
export type EvidenceTarget =
	| { transactionId: string }
	| { sourceId: string; sheet: string; row: number };
function Fields({ fields }: { fields: Record<string, string> }) {
	return (
		<dl className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
			{Object.entries(fields)
				.filter(([, value]) => value.trim())
				.map(([key, value]) => (
					<div key={key} className="contents">
						<dt className="text-muted-foreground">{key}</dt>
						<dd className="whitespace-pre-wrap break-all">{value}</dd>
					</div>
				))}
		</dl>
	);
}
export default function EvidenceDialog({
	caseId,
	target,
	onClose,
}: {
	caseId: string;
	target: EvidenceTarget;
	onClose: () => void;
}) {
	const resource = useFundsResource(
		useCallback(async () => {
			if ("transactionId" in target) {
				const result = await getFundsEvidence(caseId, target.transactionId);
				return {
					amount: formatFunds(
						result.transaction.amountMinor,
						result.transaction.currency,
					),
					rows: result.observations.map((o) => ({
						file: o.file,
						sha256: o.sourceId,
						sheet: o.sheet,
						row: o.row,
						fields: o.raw,
					})),
				};
			}
			const result = await getFundsRow(caseId, target);
			return { amount: "原始记录", rows: [result] };
		}, [caseId, target]),
	);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>来源核对</DialogTitle>
					<DialogDescription>
						保留银行原文。金额、户名或时间不一致时，以来源逐项核对。
					</DialogDescription>
				</DialogHeader>
				{resource.loading && <p role="status">正在读取来源…</p>}
				{resource.error && (
					<div role="alert" className="space-y-2">
						<p>{resource.error}</p>
						<Button onClick={() => void resource.reload()}>重试</Button>
					</div>
				)}
				{resource.data && (
					<div className="space-y-4">
						<p className="font-medium text-sm">
							{resource.data.amount} · {resource.data.rows.length} 条来源证据
						</p>
						{resource.data.rows.map((row) => (
							<section
								key={`${row.sha256}:${row.sheet}:${row.row}`}
								className="space-y-3 rounded-lg border p-4"
							>
								<h3 className="break-all font-medium text-sm">{row.file}</h3>
								<p className="text-muted-foreground text-xs">
									{row.sheet} · 第 {row.row} 行
								</p>
								<details className="text-muted-foreground text-xs">
									<summary>文件 SHA-256</summary>
									<p className="mt-1 break-all font-mono">{row.sha256}</p>
								</details>
								<Fields fields={row.fields} />
							</section>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
