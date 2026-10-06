/**
 * @file 跨案线索提示与资料纳入、排除操作。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：确认前仅显示账户线索，明确纳入来源、范围和快照版本。
 * 被调用：资金调查工作台；调用：共享 Dialog/Table 和案件关联 API。
 * 预期结果：未确认不读取外案明细，排除不会删除目标案已有来源。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
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
	excludeFundsAccount,
	fundsError,
	getFundsLinks,
	includeFundsAccount,
} from "@/lib/funds";
import { useFundsResource } from "./use-funds-resource";

type Match = Awaited<ReturnType<typeof getFundsLinks>>["matches"][number];
export default function CaseLinksPanel({
	caseId,
	onChanged,
}: {
	caseId: string;
	onChanged: () => Promise<void>;
}) {
	const data = useFundsResource(
		useCallback(() => getFundsLinks(caseId), [caseId]),
	);
	const [selected, setSelected] = useState<Match | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const unmatchedInclusions =
		data.data?.inclusions.filter(
			(i) =>
				i.active &&
				!data.data?.matches.some(
					(m) => m.originCaseId === i.originCaseId && m.account === i.account,
				),
		) ?? [];
	const include = async () => {
		if (!selected) return;
		setBusy(true);
		setError("");
		try {
			const result = await includeFundsAccount(caseId, selected);
			setMessage(result.message);
			setSelected(null);
			await data.reload();
			await onChanged();
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	const exclude = async (id: string) => {
		setBusy(true);
		setError("");
		try {
			const result = await excludeFundsAccount(caseId, id);
			setMessage(result.message);
			await data.reload();
			await onChanged();
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	return (
		<section className="flex min-w-0 flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h3 className="font-medium text-sm">其他案件中的账户线索</h3>
				<p className="text-muted-foreground text-sm">
					只提示你有权访问的案件。确认纳入前，其他案件的流水不会出现在本案的查询、汇总或资金图中。
				</p>
			</div>
			{message ? (
				<p role="status" className="text-sm">
					{message}
				</p>
			) : null}
			{error || data.error ? (
				<p role="alert" className="text-destructive text-sm">
					{error || data.error}
				</p>
			) : null}
			{data.loading ? (
				<p role="status" className="text-muted-foreground text-sm">
					正在检查案件线索…
				</p>
			) : null}
			{data.data ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>主体 / 账户</TableHead>
							<TableHead>来源案件</TableHead>
							<TableHead>本案状态</TableHead>
							<TableHead>操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.data.matches.map((match) => {
							const inclusion = data.data?.inclusions.find(
								(i) =>
									i.originCaseId === match.originCaseId &&
									i.account === match.account &&
									i.active,
							);
							return (
								<TableRow key={`${match.originCaseId}:${match.account}`}>
									<TableCell>
										<div className="flex flex-col gap-1">
											<span>{match.name}</span>
											<span className="text-muted-foreground text-xs">
												{match.account}
											</span>
										</div>
									</TableCell>
									<TableCell>{match.originCaseName}</TableCell>
									<TableCell>
										<Badge variant="outline">
											{inclusion
												? `已纳入来源版本 ${inclusion.originRevision}`
												: "仅线索 · 未纳入"}
										</Badge>
									</TableCell>
									<TableCell>
										{inclusion ? (
											<Button
												variant="outline"
												disabled={busy}
												onClick={() => void exclude(inclusion.id)}
											>
												排除本次纳入
											</Button>
										) : (
											<Button
												variant="outline"
												disabled={busy}
												onClick={() => {
													setError("");
													setSelected(match);
												}}
											>
												选择纳入
											</Button>
										)}
									</TableCell>
								</TableRow>
							);
						})}
						{!data.data.matches.length ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="py-6 text-center text-muted-foreground"
								>
									目前没有发现其他可访问案件中的相同账户。
								</TableCell>
							</TableRow>
						) : null}
					</TableBody>
				</Table>
			) : null}
			<p className="text-muted-foreground text-xs">
				按完整账号提示，不仅凭同名认定同一人。纳入的是所确认版本中涉及该账户的资料快照；来源案件后续更新不会自动加入。排除只撤销这次纳入，保留本案独立取得的资料。
			</p>
			{unmatchedInclusions.length ? (
				<div className="flex flex-col gap-3">
					<h3 className="font-medium text-sm">仍在本案中的纳入资料</h3>
					<p className="text-muted-foreground text-xs">
						来源案件当前未返回相同账户线索；此前确认的资料快照仍可排除。
					</p>
					{unmatchedInclusions.map((i) => (
						<div
							key={i.id}
							className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
						>
							<span className="text-sm">
								{i.account} · 来源版本 {i.originRevision}
							</span>
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => void exclude(i.id)}
							>
								排除本次纳入
							</Button>
						</div>
					))}
				</div>
			) : null}
			{data.data?.inclusions.some((i) => !i.active) ? (
				<details>
					<summary className="cursor-pointer text-sm">已排除的纳入记录</summary>
					<ul className="mt-3 flex flex-col gap-2 text-muted-foreground text-xs">
						{data.data.inclusions
							.filter((i) => !i.active)
							.map((i) => (
								<li key={i.id}>
									{i.account} · 来源版本 {i.originRevision} · 已排除
								</li>
							))}
					</ul>
				</details>
			) : null}
			<Dialog
				open={selected !== null}
				onOpenChange={(open) => {
					if (!open && !busy) setSelected(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>将所选账户的流水纳入本案</DialogTitle>
						<DialogDescription>
							确认后才会把相关流水加入本案，后台会重新去重并更新资金图。
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-3 text-sm">
						<p>来源案件：{selected?.originCaseName}</p>
						<p>
							账户：{selected?.name} · {selected?.account}
						</p>
						<p>
							范围：来源案件版本 {selected?.revision}{" "}
							中，以该账户为本方或对方的已取得流水。可以随后排除本次纳入。
						</p>
						{error ? (
							<p role="alert" className="text-destructive">
								{error}
							</p>
						) : null}
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => setSelected(null)}
							>
								取消
							</Button>
							<Button disabled={busy} onClick={() => void include()}>
								{busy ? "正在纳入…" : "确认纳入当前案件"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</section>
	);
}
