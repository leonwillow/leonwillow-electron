/**
 * @file 当前案件的资金分析页面。
 * 创建时间：2026-10-06
 * 修改时间：2026-11-21
 * 版本作用：资料管理独立后，仅组织资金图、交易明细与追踪。
 * 被调用：funds 路由；调用：AnalysisPanel、Eden、案件读取 Hook。
 * 功能：按 URL 案件加载分析；无资料或图未就绪时提供案件管理入口。
 * 预期结果：分析界面不显示选案、导入、清洗统计及后台任务控件。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { WaypointsIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { WorkspaceEmptyState } from "@/components/layout/async-state";
import { useFundsNavigation } from "@/components/layout/funds-navigation-provider";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { getFundsCase, listFundsCases } from "@/lib/funds";
import "./funds.css";
import AnalysisPanel from "./analysis-panel";
import FundsHeader from "./funds-header";

function CaseAnalysis({
	caseId,
	onCasesReload,
}: {
	caseId: string;
	onCasesReload: () => Promise<unknown>;
}) {
	const navigate = useNavigate();
	const details = useAsyncResource(
		useCallback(() => getFundsCase(caseId), [caseId]),
		{ keepPreviousOnReload: true },
	);
	const record = details.data;
	const waitingForGraph = !!record && record.revision !== record.graphRevision;
	useEffect(() => {
		if (!record || !waitingForGraph) return;
		let active = true;
		let checking = false;
		// 仅在图谱尚未追平数据修订时轮询轻量案件版本，追平或离开页面即停止。
		const timer = window.setInterval(async () => {
			if (document.hidden || checking) return;
			checking = true;
			try {
				const cases = await listFundsCases();
				const current = cases.find((item) => item.id === caseId);
				if (
					active &&
					current &&
					(current.revision !== record.revision ||
						current.graphRevision !== record.graphRevision)
				) {
					await details.reload();
					void onCasesReload();
				}
			} catch {
				// 临时网络故障保留当前分析；后续轮询恢复，不清空正在查阅的交易。
			} finally {
				checking = false;
			}
		}, 5000);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [caseId, record, waitingForGraph, details.reload, onCasesReload]);
	if (details.loading && !record)
		return (
			<p role="status" className="p-6 text-muted-foreground text-sm">
				正在读取案件…
			</p>
		);
	if (!record)
		return (
			<div role="alert" className="flex flex-col items-start gap-3 p-6">
				<p>{details.error}</p>
				<Button onClick={() => void details.reload()}>重试案件读取</Button>
			</div>
		);
	return (
		<div className="min-h-0 flex-1 overflow-hidden">
			<div className="h-full min-h-0">
				{!record.totals.sourceCount || waitingForGraph ? (
					<ScrollArea
						className="mx-auto h-full max-w-[110rem]"
						contentClassName="flex flex-col items-start gap-3 px-4 py-8 sm:px-6"
					>
						<h2 className="font-medium text-sm">
							{waitingForGraph ? "案件资料正在处理" : "这个案件还没有流水"}
						</h2>
						<p className="text-muted-foreground text-sm">
							{waitingForGraph
								? "处理完成后将自动显示资金关系。"
								: "先到案件管理导入已取得的银行流水，再开始分析。"}
						</p>
						<Button
							variant="outline"
							onClick={() =>
								void navigate({ to: "/funds/cases", search: { caseId } })
							}
						>
							{waitingForGraph ? "查看处理进度" : "前往案件管理"}
						</Button>
					</ScrollArea>
				) : (
					<AnalysisPanel key={`${caseId}:${record.revision}`} caseId={caseId} />
				)}
			</div>
		</div>
	);
}

export default function FundsView() {
	const route = getRouteApi("/_workspace/funds");
	const { caseId } = route.useSearch();
	const menu = useFundsNavigation();
	return (
		<div className="flex h-full min-h-0 flex-col">
			<FundsHeader
				caseId={caseId}
				caseName={menu.cases.data?.find((record) => record.id === caseId)?.name}
			/>
			{caseId ? (
				<CaseAnalysis
					key={caseId}
					caseId={caseId}
					onCasesReload={menu.cases.reload}
				/>
			) : (
				<WorkspaceEmptyState
					icon={WaypointsIcon}
					title="选择案件开始分析"
					actions={
						<Button variant="outline" onClick={menu.focusPanel}>
							选择案件
						</Button>
					}
				/>
			)}
		</div>
	);
}
