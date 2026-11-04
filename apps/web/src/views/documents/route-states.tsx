/**
 * @file 文书路由加载与服务失败的可重试状态。
 * 创建时间：2026-10-10；修改时间：2026-10-10。
 * 版本作用：沿用工作台现有状态展示，不把后端故障当空列表。
 * 被调用：documents 路由；调用：共享 Button、Router、文书错误转换。
 * 预期结果：加载可见，失败可重试，未登录和授权由父路由处理。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { useRouter } from "@tanstack/react-router";
import { documentError } from "@/lib/documents";
export function DocumentsPendingView() {
	return (
		<p className="p-6 text-muted-foreground text-sm" role="status">
			正在读取文书模板…
		</p>
	);
}
export function DocumentsErrorView({ error }: { error: unknown }) {
	const router = useRouter();
	return (
		<div className="flex flex-col items-start gap-3 p-6">
			<h1 className="font-medium text-lg">文书服务暂时无法打开</h1>
			<p role="alert" className="text-muted-foreground text-sm">
				{documentError(error)}
			</p>
			<Button onClick={() => void router.invalidate()}>重新加载</Button>
		</div>
	);
}
