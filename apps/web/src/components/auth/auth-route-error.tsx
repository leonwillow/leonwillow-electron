/**
 * @file 工作台会话加载失败的恢复界面。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/_workspace/route.tsx。
 * 调用：ui 基础组件/样式、@tanstack/react-router。
 * 功能：提供重试和前往登录的操作。
 * 预期结果：服务异常可见且可重试，不被误判为正常未登录。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Link, useRouter } from "@tanstack/react-router";

export default function AuthRouteError() {
	const router = useRouter();
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6">
			<h1 className="font-semibold text-lg">暂时无法读取登录状态</h1>
			<p role="alert" className="text-muted-foreground text-sm">
				服务暂时不可用，请稍后重试。
			</p>
			<div className="flex gap-2">
				<Button onClick={() => router.invalidate()}>重试</Button>
				<Button variant="outline" render={<Link to="/login" />}>
					前往登录
				</Button>
			</div>
		</main>
	);
}
