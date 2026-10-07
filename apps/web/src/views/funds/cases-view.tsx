/**
 * @file 案件管理、流水导入与清洗核对页面。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-07
 * 版本作用：将资料准备从资金分析中分离，保留既有导入与核对组件。
 * 被调用：funds_.cases 路由；调用：共享 UI、Eden、流水与核对面板。
 * 功能：案件选择/创建、文件导入/下载、处理进度、清洗与跨案资料管理。
 * 预期结果：用户自由决定追踪起点，不内置演示付款；错误与部分待核可见。
 */

import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
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
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi } from "@tanstack/react-router";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useFundsNavigation } from "@/components/layout/funds-navigation-provider";
import {
	downloadFundsCsv,
	downloadFundsOriginal,
	fundsError,
	getFundsCase,
	getFundsSummary,
	syncFunds,
} from "@/lib/funds";
import CaseLinksPanel from "./case-links-panel";
import FundsHeader from "./funds-header";
import PipelinePanel from "./pipeline-panel";
import ReviewPanel from "./review-panel";
import { useFundsResource } from "./use-funds-resource";

function CaseWorkspace({ caseId }: { caseId: string }) {
	const details = useFundsResource(
		useCallback(() => getFundsCase(caseId), [caseId]),
	);
	const [reviewMode, setReviewMode] = useState<
		"issues" | "candidates" | "subjects"
	>("issues");
	const [tab, setTab] = useState("sources");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const summary = useFundsResource(
		useCallback(() => getFundsSummary(caseId), [caseId]),
	);
	const refresh = async () => {
		await details.reload();
		await summary.reload();
	};
	const sync = async () => {
		setBusy(true);
		setError("");
		try {
			const result = await syncFunds(caseId);
			setMessage(result.message);
			await refresh();
		} catch (e) {
			setError(fundsError(e));
		} finally {
			setBusy(false);
		}
	};
	const original = async (sourceId: string, name: string) => {
		try {
			await downloadFundsOriginal(caseId, sourceId, name);
		} catch (e) {
			setError(fundsError(e));
		}
	};
	const download = async () => {
		try {
			await downloadFundsCsv(caseId);
		} catch (e) {
			setError(fundsError(e));
		}
	};
	if (details.loading)
		return (
			<p className="p-6 text-muted-foreground text-sm" role="status">
				正在读取完整案件…
			</p>
		);
	if (!details.data)
		return (
			<div className="space-y-3 p-6" role="alert">
				<p>{details.error}</p>
				<Button onClick={() => void details.reload()}>重试案件读取</Button>
			</div>
		);
	const record = details.data;
	const totals = record.totals;
	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<div className="mx-auto max-w-[110rem] space-y-5 p-4 sm:p-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="font-semibold text-lg">{record.name}</h2>
						<p className="mt-1 text-muted-foreground text-xs">
							{totals.sourceCount} 个文件 ·{" "}
							{totals.rawRows.toLocaleString("zh-CN")} 条原始记录 · 数据版本{" "}
							{record.revision}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => void refresh()}
						>
							<RefreshCwIcon />
							刷新
						</Button>
					</div>
				</div>
				{(message || busy) && (
					<p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">
						{busy ? "正在提交处理请求…" : message}
					</p>
				)}
				{error && (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				)}
				{record.revision !== record.graphRevision && (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
						<p className="text-sm">
							资料已保存，后台正在更新资金图。可到“文件与导入”查看处理进度。
						</p>
						<Button disabled={busy} onClick={() => void sync()}>
							重试同步
						</Button>
					</div>
				)}
				<div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm">
					<span>
						<strong className="tabular-nums">
							{totals.transactionCount.toLocaleString("zh-CN")}
						</strong>{" "}
						条规范交易
					</span>
					<span>
						<strong className="tabular-nums">
							{summary.data?.statementAccounts ?? "—"}
						</strong>{" "}
						个账户已有流水
					</span>
					<span>
						<strong className="tabular-nums">{totals.candidates}</strong>{" "}
						组配对待核
					</span>
					<span>
						<strong className="tabular-nums">{totals.quarantined}</strong>{" "}
						条记录待核
					</span>
					<span className="text-muted-foreground">
						{summary.data?.first?.slice(0, 10)}
						{summary.data?.last ? ` 至 ${summary.data.last.slice(0, 10)}` : ""}
					</span>
				</div>
				<Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
					<TabsList variant="line">
						<TabsTrigger value="sources">文件与导入</TabsTrigger>
						<TabsTrigger value="review">清洗核对</TabsTrigger>
						<TabsTrigger value="links">跨案线索</TabsTrigger>
					</TabsList>
					<TabsContent value="review" className="pt-4">
						<ReviewPanel
							key={`${caseId}:${record.revision}`}
							mode={reviewMode}
							onModeChange={setReviewMode}
							record={record}
							onChanged={refresh}
						/>
					</TabsContent>
					<TabsContent value="links" className="pt-4">
						<CaseLinksPanel
							key={`${caseId}:${record.revision}`}
							caseId={caseId}
							onChanged={refresh}
						/>
					</TabsContent>
					<TabsContent value="sources" className="space-y-6 pt-4" keepMounted>
						<PipelinePanel
							caseId={caseId}
							revision={record.revision}
							graphRevision={record.graphRevision}
							onChanged={refresh}
						/>
						<section className="space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h3 className="font-medium text-sm">已导入的全部文件</h3>
								<Button
									variant="outline"
									disabled={!totals.sourceCount}
									onClick={() => void download()}
								>
									<DownloadIcon />
									导出标准流水 CSV
								</Button>
							</div>
							<p className="text-muted-foreground text-xs">
								标准流水导出保留合格来源观测，含跨文件重叠和双边记录。图中交易已经归并；两者行数不同。
							</p>
							<div className="rounded-lg border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>文件名</TableHead>
											<TableHead>原件</TableHead>
											<TableHead>编码</TableHead>
											<TableHead className="text-right">原始行</TableHead>
											<TableHead className="text-right">合格观测</TableHead>
											<TableHead className="text-right">反馈</TableHead>
											<TableHead className="text-right">开户资料</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{record.sources.map((source) => (
											<TableRow key={source.id}>
												<TooltipText content={source.name}>
													<TableCell className="max-w-96 truncate text-xs">
														{source.name}
													</TableCell>
												</TooltipText>
												<TableCell>
													<Button
														variant="ghost"
														size="sm"
														aria-label={`下载 ${source.name} 来源文件`}
														onClick={() =>
															void original(
																source.id,
																source.isSnapshot
																	? `${source.name.replace(/\.[^.]+$/, "")}.纳入快照.csv`
																	: source.name,
															)
														}
													>
														{source.isSnapshot ? "下载纳入快照" : "下载原件"}
													</Button>
												</TableCell>
												<TableCell className="text-xs">
													{source.encoding}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{source.rowCount}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{source.observations}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{source.feedbackCount}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{source.auxiliaryCount}
												</TableCell>
											</TableRow>
										))}
										{!record.sources.length && (
											<TableRow>
												<TableCell
													colSpan={7}
													className="py-8 text-center text-muted-foreground"
												>
													当前案件还没有导入文件。
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
							<p className="text-muted-foreground text-xs">
								{totals.rawRows.toLocaleString("zh-CN")} 原始行 ={" "}
								{totals.observations.toLocaleString("zh-CN")} 合格观测 +{" "}
								{totals.quarantined} 待核 + {totals.feedback} 查询反馈 +{" "}
								{totals.auxiliary} 开户资料。合格观测中归并{" "}
								{totals.duplicates.toLocaleString("zh-CN")} 条跨文件重复及{" "}
								{totals.mirrored} 对双边记录。
							</p>
						</section>
						<section className="space-y-3">
							<h3 className="font-medium text-sm">最近版本记录</h3>
							<div className="divide-y rounded-lg border">
								{record.history.map((version) => (
									<div
										key={version.revision}
										className="flex flex-wrap items-center gap-3 p-3 text-xs"
									>
										<Badge variant="outline">版本 {version.revision}</Badge>
										<span>
											{version.action.startsWith("import:")
												? `导入 ${version.action.split(":")[1]} 个文件`
												: version.action.startsWith("include:")
													? "确认纳入跨案资料"
													: version.action.startsWith("exclude:")
														? "排除跨案资料"
														: version.action.startsWith("subjects:scan:")
															? "后台重新识别主体"
															: version.action === "subjects:merge"
																? "人工合并主体"
																: version.action === "subjects:separate"
																	? "人工拆分主体"
																	: version.action === "subjects:undo"
																		? "撤销主体调整"
																		: version.action === "match:merge"
																			? "人工确认同一交易"
																			: "人工保留为不同交易"}
										</span>
										<span className="text-muted-foreground">
											{new Date(version.createdAt).toLocaleString("zh-CN")}
										</span>
									</div>
								))}
							</div>
						</section>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

export default function CasesView() {
	const route = getRouteApi("/_workspace/funds_/cases");
	const { caseId } = route.useSearch();
	const menu = useFundsNavigation();
	const [error, setError] = useState("");
	const template = async () => {
		try {
			await downloadFundsCsv();
		} catch (e) {
			setError(fundsError(e));
		}
	};
	return (
		<div className="flex h-full min-h-0 flex-col">
			<FundsHeader caseId={caseId} />
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-b p-4 sm:px-6">
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => void template()}>
						<DownloadIcon />
						标准 CSV 模板
					</Button>
				</div>
			</div>
			{error && (
				<p role="alert" className="px-6 py-2 text-destructive text-sm">
					{error}
				</p>
			)}
			{caseId ? (
				<CaseWorkspace key={caseId} caseId={caseId} />
			) : (
				<div className="mx-auto flex max-w-2xl flex-1 flex-col items-start justify-center gap-4 p-6">
					<h2 className="font-semibold text-xl">选择案件，管理流水资料</h2>
					<p className="text-muted-foreground text-sm">
						从左侧案件列表选择案件，或点击菜单顶部的加号新增案件。
					</p>
					<Button onClick={menu.focusPanel}>选择案件</Button>
				</div>
			)}
		</div>
	);
}
