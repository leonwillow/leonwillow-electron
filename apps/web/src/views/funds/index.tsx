/**
 * @file 当前案件的资金分析页面。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-08
 * 版本作用：资料管理独立后，仅组织资金图、交易明细与追踪。
 * 被调用：funds 路由；调用：AnalysisPanel、Eden、案件读取 Hook。
 * 功能：按 URL 案件加载分析；无资料或图未就绪时提供案件管理入口。
 * 预期结果：分析界面不显示选案、导入、清洗统计及后台任务控件。
 */
import {
	Button,
	buttonVariants,
} from "@leonwillow-electron/ui/components/button";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useFundsNavigation } from "@/components/layout/funds-navigation-provider";
import { getFundsCase, listFundsCases } from "@/lib/funds";
import AnalysisPanel from "./analysis-panel";
import FundsHeader from "./funds-header";
import { useFundsResource } from "./use-funds-resource";

function CaseAnalysis({ caseId }: { caseId: string }) {
	const details = useFundsResource(
		useCallback(() => getFundsCase(caseId), [caseId]),
	);
	const record = details.data;
	const waitingForGraph = !!record && record.revision !== record.graphRevision;
	useEffect(() => {
		if (!record) return;
		let active = true;
		let checking = false;
		// 只轮询轻量案件版本，资料发生变化后才重读来源与分析，离开页面即停止。
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
				)
					await details.reload();
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
	}, [caseId, record, details.reload]);
	if (details.loading)
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
					<div className="mx-auto flex h-full max-w-[110rem] flex-col items-start gap-3 overflow-auto px-4 py-8 sm:px-6">
						<h2 className="font-medium text-sm">
							{waitingForGraph ? "案件资料正在处理" : "这个案件还没有流水"}
						</h2>
						<p className="text-muted-foreground text-sm">
							{waitingForGraph
								? "处理完成后将自动显示资金关系。"
								: "先到案件管理导入已取得的银行流水，再开始分析。"}
						</p>
						<Link
							to="/funds/cases"
							search={{ caseId }}
							className={cn(buttonVariants({ variant: "outline" }))}
						>
							{waitingForGraph ? "查看处理进度" : "前往案件管理"}
						</Link>
					</div>
				) : (
					<AnalysisPanel key={`${caseId}:${record.revision}`} caseId={caseId} />
				)}
			</div>
		</div>
	);
}

export default function FundsView() {
	const route = getRouteApi("/_workspace/funds");
	const cases = route.useLoaderData();
	const { caseId: selectedCaseId } = route.useSearch();
	const caseId = selectedCaseId;
	const menu = useFundsNavigation();
	return (
		<div className="flex h-full min-h-0 flex-col">
			<FundsHeader
				caseId={caseId}
				caseName={cases.find((record) => record.id === caseId)?.name}
			/>
			{caseId ? (
				<CaseAnalysis key={caseId} caseId={caseId} />
			) : (
				<div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-4 p-6">
					<h2 className="font-semibold text-xl">选择案件，开始资金分析</h2>
					<p className="text-muted-foreground text-sm">
						从左侧选择案件，或点击案件菜单顶部的加号新增案件。
					</p>
					<Button variant="outline" onClick={menu.focusPanel}>
						选择案件
					</Button>
				</div>
			)}
		</div>
	);
}
