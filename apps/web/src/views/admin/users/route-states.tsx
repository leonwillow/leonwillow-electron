/**
 * @file 人员管理路由的加载和错误状态。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：让路由状态与管理表单分别加载。
 * 被调用：admin.users 路由。
 * 调用：共享 Button、TanStack Router。
 * 功能：显示加载提示和重试操作。
 * 预期结果：首屏无需载入人员表单与校验依赖。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { useRouter } from "@tanstack/react-router";

export function UsersErrorView() {
	const router = useRouter();
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
			<h1 className="font-semibold text-lg">暂时无法读取人员与权限</h1>
			<p className="text-muted-foreground text-sm" role="alert">
				请检查连接后重试。如果权限发生变化，刷新后会重新检查。
			</p>
			<Button onClick={() => router.invalidate()}>重试</Button>
		</div>
	);
}

export function UsersPendingView() {
	return (
		<div className="p-6 text-muted-foreground text-sm" role="status">
			正在读取人员与权限…
		</div>
	);
}
