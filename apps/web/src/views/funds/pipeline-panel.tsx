/**
 * @file 案件原始流水上传与后台处理记录。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-05
 * 版本作用：AI 标准化是默认入口，已有模板可直接提交；结果可下载和核验。
 * 被调用：资金调查文件页签；调用：共享 UI、Eden 案件任务接口。
 * 预期结果：离开页面不停止任务，轮询不会把另一案件的结果带入当前页面。
 */

import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { DownloadIcon, FileUpIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	downloadFundsStandardFile,
	formatFunds,
	fundsError,
	getFundsJobs,
	importFunds,
	retryFundsJob,
	standardizeFunds,
} from "@/lib/funds";

const stages: Record<string, string> = {
	queued: "等待处理",
	standardizing: "AI 标准化",
	validating: "校验标准文件",
	validated: "标准文件已生成",
	reconciling: "整理与去重",
	identifying: "识别主体归属",
	projecting: "更新资金图",
	completed: "已完成",
	retrying: "等待自动重试",
	failed: "处理失败",
};
type Job = Awaited<ReturnType<typeof getFundsJobs>>[number];

export default function PipelinePanel({
	caseId,
	revision,
	graphRevision,
	onChanged,
}: {
	caseId: string;
	revision: number;
	graphRevision: number;
	onChanged: () => Promise<void>;
}) {
	const [mode, setMode] = useState("ai");
	const [files, setFiles] = useState<File[]>([]);
	const [jobs, setJobs] = useState<Job[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [inputVersion, setInputVersion] = useState(0);
	const expandedJobId =
		jobs?.find((job) => job.status !== "completed")?.id ??
		jobs?.find((job) => job.mode !== "sync")?.id ??
		jobs?.[0]?.id;
	const changed = useRef(onChanged);
	const versions = useRef({ revision, graphRevision });
	useEffect(() => {
		changed.current = onChanged;
		versions.current = { revision, graphRevision };
	}, [onChanged, revision, graphRevision]);
	const reload = useCallback(() => getFundsJobs(caseId), [caseId]);
	useEffect(() => {
		let active = true;
		let timeout: ReturnType<typeof setTimeout>;
		const poll = async () => {
			try {
				const next = await reload();
				if (!active) return;
				setJobs(next);
				const completed = next.find(
					(j) =>
						j.result &&
						(j.result.revision > versions.current.revision ||
							j.result.graphRevision > versions.current.graphRevision),
				);
				if (completed?.result) {
					versions.current = {
						revision: completed.result.revision,
						graphRevision: completed.result.graphRevision,
					};
					await changed.current();
				}
			} catch (e) {
				if (active) setError(fundsError(e));
			}
			if (active) timeout = setTimeout(() => void poll(), 2500);
		};
		void poll();
		return () => {
			active = false;
			clearTimeout(timeout);
		};
	}, [reload]);
	const upload = async () => {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const result =
				mode === "ai"
					? await standardizeFunds(caseId, files)
					: await importFunds(caseId, files);
			setMessage(result.message);
			setFiles([]);
			setInputVersion((v) => v + 1);
			setJobs(await reload());
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	const download = async (
		job: Job,
		file: Job["files"][number],
		format: "csv" | "report" | "original",
	) => {
		try {
			await downloadFundsStandardFile(
				caseId,
				job.id,
				file.id,
				file.name,
				format,
			);
		} catch (e) {
			setError(fundsError(e));
		}
	};
	const retry = async (id: string) => {
		setBusy(true);
		setError("");
		try {
			await retryFundsJob(caseId, id);
			setJobs(await reload());
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="flex min-w-0 flex-col gap-6">
			<section
				className="flex flex-col gap-4 rounded-lg border p-4 sm:p-5"
				aria-label="流水标准化与导入"
			>
				<div className="flex flex-col gap-1">
					<h3 className="font-medium text-sm">从原始流水开始</h3>
					<p className="text-muted-foreground text-xs">
						上传这个案件的原始文件，AI 统一为 13
						列标准表，后台继续完成入库、去重与资金图更新。
					</p>
				</div>
				<Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
					<TabsList>
						<TabsTrigger value="ai">原始文件 · AI 标准化</TabsTrigger>
						<TabsTrigger value="standard">已有标准 CSV / Excel</TabsTrigger>
					</TabsList>
				</Tabs>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="statement-files">
							{mode === "ai" ? "选择银行原始文件" : "选择标准文件"}
						</FieldLabel>
						<Input
							key={inputVersion}
							id="statement-files"
							type="file"
							accept=".xlsx,.xls,.csv,.tsv"
							multiple
							disabled={busy}
							onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
						/>
						<FieldDescription>
							Excel、CSV、TSV；每批最多 32 个文件，单文件 20 MB、整批 100
							MB。标准 CSV 与转换报告可在处理记录中下载。
						</FieldDescription>
					</Field>
				</FieldGroup>
				{files.length > 0 ? (
					<ScrollArea
						className="max-h-32 text-xs"
						contentClassName=""
						contentRender={<ul />}
					>
						{files.map((file, i) => (
							<li key={`${i}:${file.name}`} className="break-all">
								{file.name} · {(file.size / 1024).toFixed(1)} KB
							</li>
						))}
					</ScrollArea>
				) : null}
				<div className="flex flex-wrap items-center gap-3">
					<Button
						disabled={!files.length || busy}
						onClick={() => void upload()}
					>
						<FileUpIcon data-icon="inline-start" />
						{busy
							? "正在上传…"
							: mode === "ai"
								? "开始标准化并导入"
								: "导入标准文件"}
					</Button>
					<span className="text-muted-foreground text-xs">
						上传完成后可离开页面，后台继续处理。
					</span>
				</div>
				{message ? (
					<p role="status" className="text-sm">
						{message}
					</p>
				) : null}
				{error ? (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				) : null}
			</section>
			<section
				className="flex min-w-0 flex-col gap-3"
				aria-label="后台处理记录"
			>
				<h3 className="font-medium text-sm">后台处理记录</h3>
				{!jobs ? (
					<p role="status" className="text-muted-foreground text-sm">
						正在读取任务…
					</p>
				) : jobs.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						上传后，这里会记录标准化、去重和图入库的全过程。
					</p>
				) : null}
				{jobs?.map((job) => (
					<details
						key={job.id}
						open={job.id === expandedJobId}
						className="min-w-0 rounded-lg border p-4"
					>
						<summary className="cursor-pointer text-sm">
							<span className="mr-3 font-medium">
								{job.mode === "ai"
									? "AI 标准化与导入"
									: job.mode === "sync"
										? "资金图同步"
										: job.mode === "subjects"
											? "主体重新识别"
											: "标准文件导入"}
							</span>
							<Badge
								variant={job.status === "failed" ? "destructive" : "secondary"}
							>
								{stages[job.stage] ?? job.stage}
							</Badge>
							<span className="ml-3 text-muted-foreground text-xs">
								{new Date(job.createdAt).toLocaleString("zh-CN")}
							</span>
						</summary>
						<div className="mt-4 flex min-w-0 flex-col gap-4">
							<p role="status" className="text-sm">
								{job.events.at(-1)?.message ?? "任务等待后台领取。"}
								{job.totalFiles
									? ` 已完成文件 ${job.completedFiles} / ${job.totalFiles}。`
									: ""}
							</p>
							{job.error ? (
								<p className="break-words text-destructive text-xs">
									{job.error}
									{job.status === "queued" ? " 系统将自动重试。" : ""}
								</p>
							) : null}
							{job.status === "failed" ? (
								<Button
									variant="outline"
									className="self-start"
									disabled={busy}
									onClick={() => void retry(job.id)}
								>
									<RefreshCwIcon data-icon="inline-start" />
									从未完成处重试
								</Button>
							) : null}
							{job.result ? (
								<div className="flex flex-col gap-2 text-sm">
									<p>
										本次处理后：
										{job.result.totals.transactionCount.toLocaleString("zh-CN")}{" "}
										笔唯一交易；归并重复{" "}
										{job.result.totals.duplicates.toLocaleString("zh-CN")}{" "}
										条、双边对应 {job.result.totals.mirrored} 对。
									</p>
									{job.result.subjectSummary && (
										<p className="text-xs">
											主体归属：{job.result.subjectSummary.subjects}{" "}
											个已知主体，{job.result.subjectSummary.mergedGroups}{" "}
											组包含多个账户，{job.result.subjectSummary.inferredGroups}{" "}
											组按完整户名推断。详情与更正在“清洗核对 → 主体归属”。
										</p>
									)}
									<p className="text-muted-foreground text-xs">
										待核记录 {job.result.totals.quarantined} 条；配对候选{" "}
										{job.result.totals.candidates} 组；暂缓入图{" "}
										{job.result.totals.heldTransactions ?? 0} 笔。资料版本{" "}
										{job.result.revision} / 图版本 {job.result.graphRevision}
										，入图笔数核验通过。
									</p>
								</div>
							) : null}
							{job.files.length ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>文件 / 核验</TableHead>
											<TableHead className="text-right">原始行</TableHead>
											<TableHead className="text-right">标准行</TableHead>
											<TableHead className="text-right">待核</TableHead>
											<TableHead>下载</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{job.files.map((file) => (
											<TableRow key={file.id}>
												<TableCell className="min-w-48 max-w-96 whitespace-normal">
													<details>
														<summary className="cursor-pointer break-all">
															{file.name}
														</summary>
														{file.fileRef && (
															<p className="my-2 break-all text-muted-foreground text-xs">
																原件已保存至 RustFS ·{" "}
																{file.fileRef.size.toLocaleString("zh-CN")} 字节
																<br />
																SHA-256：{file.fileRef.sha256}
															</p>
														)}
														{file.report ? (
															<div className="mt-2 flex flex-col gap-2 text-xs">
																<p>
																	{file.report.model} ·{" "}
																	{file.report.rowConservation
																		? "行数守恒通过"
																		: "行数核验未通过"}
																</p>
																<p>
																	收入{" "}
																	{formatFunds(
																		file.report.amountTotals.incomingMinor,
																	)}
																	；支出{" "}
																	{formatFunds(
																		file.report.amountTotals.outgoingMinor,
																	)}
																</p>
																<p>
																	查询反馈 {file.report.feedback} 行，开户资料{" "}
																	{file.report.auxiliary} 行。
																</p>
																{file.report.mappings.map((mapping) => (
																	<p key={mapping.sheet}>
																		{mapping.sheet}：{mapping.explanation}
																	</p>
																))}
															</div>
														) : (
															<p className="mt-2 text-muted-foreground text-xs">
																尚未完成标准化。
															</p>
														)}
													</details>
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{file.report?.rawRows ?? "—"}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{file.report?.standardRows ?? "—"}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{file.report?.quarantined ?? "—"}
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Button
															variant="outline"
															size="sm"
															aria-label={`下载 ${file.name} 原件`}
															onClick={() =>
																void download(job, file, "original")
															}
														>
															原件
														</Button>
														<Button
															variant="outline"
															size="sm"
															disabled={file.status !== "ready"}
															aria-label={`下载 ${file.name} 标准 CSV`}
															onClick={() => void download(job, file, "csv")}
														>
															<DownloadIcon data-icon="inline-start" />
															CSV
														</Button>
														<Button
															variant="ghost"
															size="sm"
															disabled={file.status !== "ready"}
															aria-label={`下载 ${file.name} 转换报告`}
															onClick={() => void download(job, file, "report")}
														>
															报告
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : null}
							<details>
								<summary className="cursor-pointer text-muted-foreground text-xs">
									查看各阶段记录
								</summary>
								<ScrollArea
									className="mt-3 max-h-64 text-xs"
									contentClassName="flex flex-col gap-2"
									contentRender={<ol />}
								>
									{job.events.map((event, i) => (
										<li key={`${event.at}:${i}`}>
											<time className="mr-3 text-muted-foreground">
												{new Date(event.at).toLocaleTimeString("zh-CN")}
											</time>
											{event.message}
										</li>
									))}
								</ScrollArea>
							</details>
						</div>
					</details>
				))}
			</section>
		</div>
	);
}
