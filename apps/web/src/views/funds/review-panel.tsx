/**
 * @file 归并候选与清洗问题核对面板。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：不确定配对由人员决定，原值可追溯。
 * 被调用：funds 工作台；调用：Eden 和证据弹窗。
 * 预期结果：决定带版本提交，过期提示刷新，不静默覆盖新增证据。
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
import { useCallback, useState } from "react";
import {
	decideFundsMatch,
	type FundsCase,
	formatFunds,
	fundsError,
	getFundsReview,
} from "@/lib/funds";
import EvidenceDialog, { type EvidenceTarget } from "./evidence-dialog";
import { useFundsResource } from "./use-funds-resource";

const issueNames: Record<string, string> = {
	quarantine: "待核记录",
	"name-conflict": "户名冲突",
	"unknown-counterparty": "对手账号缺失",
	feedback: "查询反馈",
	"unsupported-sheet": "未识别工作表",
};
export default function ReviewPanel({
	record,
	onChanged,
}: {
	record: FundsCase;
	onChanged: () => Promise<void>;
}) {
	const [offset, setOffset] = useState(0);
	const [kind, setKind] = useState("quarantine");
	const [mode, setMode] = useState<"issues" | "candidates">("issues");
	const [target, setTarget] = useState<EvidenceTarget | null>(null);
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const resource = useFundsResource(
		useCallback(
			() => getFundsReview(record.id, offset, kind),
			[record.id, offset, kind],
		),
	);
	const decide = async (id: string, action: "merge" | "separate") => {
		setBusy(id);
		setError("");
		try {
			await decideFundsMatch(record.id, id, action, record.revision);
			await onChanged();
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy("");
		}
	};
	const total =
		mode === "issues"
			? (resource.data?.total ?? 0)
			: (resource.data?.candidateTotal ?? 0);
	return (
		<section className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<Button
					variant={mode === "issues" ? "secondary" : "ghost"}
					onClick={() => {
						setMode("issues");
						setOffset(0);
					}}
				>
					清洗问题
				</Button>
				<Button
					variant={mode === "candidates" ? "secondary" : "ghost"}
					onClick={() => {
						setMode("candidates");
						setOffset(0);
					}}
				>
					双边配对候选 · {record.totals.candidates}
				</Button>
			</div>
			<p className="max-w-3xl text-muted-foreground text-sm">
				{mode === "issues"
					? "待核记录保留银行原值，暂不计入图金额。对手账号缺失的合格交易使用独立待核节点。"
					: "以下记录在整组自动匹配后仍有冲突，相关交易暂缓入图，避免重复计数。请核对两侧原文，再决定是否为同一交易。"}
			</p>
			{mode === "issues" && (
				<fieldset className="flex flex-wrap gap-2" aria-label="问题类型">
					{Object.entries(issueNames).map(([value, name]) => (
						<Button
							key={value}
							variant={kind === value ? "secondary" : "outline"}
							aria-pressed={kind === value}
							onClick={() => {
								setKind(value);
								setOffset(0);
							}}
						>
							{name}
						</Button>
					))}
				</fieldset>
			)}
			{(resource.error || error) && (
				<div role="alert" className="space-y-2 text-destructive text-sm">
					<p>{resource.error || error}</p>
					<Button variant="outline" onClick={() => void resource.reload()}>
						重新读取
					</Button>
				</div>
			)}
			{resource.loading && (
				<p role="status" className="text-muted-foreground text-sm">
					正在读取核对记录…
				</p>
			)}
			{mode === "issues" ? (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>来源文件</TableHead>
								<TableHead>位置</TableHead>
								<TableHead>处理原因</TableHead>
								<TableHead>操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{resource.data?.issues.map((issue) => (
								<TableRow key={issue.id}>
									<TableCell
										className="max-w-64 truncate text-xs"
										title={
											record.sources.find((s) => s.id === issue.sourceId)?.name
										}
									>
										{record.sources.find((s) => s.id === issue.sourceId)?.name}
									</TableCell>
									<TableCell className="whitespace-nowrap text-xs">
										{issue.sheet} · {issue.row} 行
									</TableCell>
									<TableCell className="min-w-56 max-w-xl whitespace-normal text-xs">
										{issue.message}
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											onClick={() =>
												setTarget({
													sourceId: issue.sourceId,
													sheet: issue.sheet,
													row: issue.row,
												})
											}
										>
											查看原文
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : (
				<div className="space-y-3">
					{resource.data?.candidates.map((candidate) => (
						<article
							key={candidate.id}
							className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
						>
							<div className="min-w-0 space-y-1 text-xs">
								<p className="font-medium text-sm">
									{formatFunds(candidate.amountMinor)} · 时间差{" "}
									{candidate.seconds} 秒
								</p>
								<p className="break-all font-mono text-muted-foreground">
									{candidate.from} → {candidate.to}
								</p>
								<div className="flex gap-2">
									<Button
										variant="ghost"
										onClick={() => setTarget({ transactionId: candidate.left })}
									>
										付款侧原文
									</Button>
									<Button
										variant="ghost"
										onClick={() =>
											setTarget({ transactionId: candidate.right })
										}
									>
										收款侧原文
									</Button>
								</div>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									disabled={!!busy}
									onClick={() => void decide(candidate.id, "separate")}
								>
									保留为两笔
								</Button>
								<Button
									disabled={!!busy}
									onClick={() => void decide(candidate.id, "merge")}
								>
									{busy === candidate.id ? "正在保存…" : "确认同一交易"}
								</Button>
							</div>
						</article>
					))}
				</div>
			)}
			{!resource.loading && !resource.error && total === 0 && (
				<p className="rounded-lg border p-8 text-center text-muted-foreground text-sm">
					当前分类没有待核对记录。
				</p>
			)}
			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span>
					{total
						? `${offset + 1}–${Math.min(offset + 50, total)} / ${total}`
						: "0 条"}
				</span>
				<div className="flex gap-2">
					<Button
						variant="outline"
						disabled={!offset || resource.loading}
						onClick={() => setOffset(offset - 50)}
					>
						上一页
					</Button>
					<Button
						variant="outline"
						disabled={offset + 50 >= total || resource.loading}
						onClick={() => setOffset(offset + 50)}
					>
						下一页
					</Button>
				</div>
			</div>
			{target && (
				<EvidenceDialog
					caseId={record.id}
					target={target}
					onClose={() => setTarget(null)}
				/>
			)}
		</section>
	);
}
