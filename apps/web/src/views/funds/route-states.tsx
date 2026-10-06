/**
 * @file 资金调查路由的加载与失败展示。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：复用现有管理页面状态风格。
 * 被调用：funds 路由；调用：共享 Button 和 Router。
 * 预期结果：加载和网络故障可见，允许重试。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { useRouter } from "@tanstack/react-router";
export function FundsPendingView() {
	return (
		<p className="p-6 text-muted-foreground text-sm" role="status">
			正在读取案件…
		</p>
	);
}
export function FundsErrorView({ error }: { error: unknown }) {
	const router = useRouter();
	return (
		<div className="space-y-3 p-6">
			<h1 className="font-semibold text-lg">案件暂时无法打开</h1>
			<p className="text-muted-foreground text-sm" role="alert">
				{error instanceof Error ? error.message : "无法连接服务"}
			</p>
			<Button onClick={() => void router.invalidate()}>重新加载</Button>
		</div>
	);
}
