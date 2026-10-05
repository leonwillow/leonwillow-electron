/**
 * @file 功能访问被拒绝时的说明视图。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：工作台权限空状态。
 * 被调用：access-denied 路由。
 * 调用：共享 Button、Router、功能目录。
 * 功能：提示联系管理员并提供刷新授权和可用入口。
 * 预期结果：首次未授权和权限撤销都有清晰、可操作的反馈。
 */
import { firstAccessiblePath } from "@leonwillow-electron/access";
import { Button } from "@leonwillow-electron/ui/components/button";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { ShieldOffIcon } from "lucide-react";

export default function AccessDeniedView() {
	const { user, moduleIds } = getRouteApi("/_workspace").useRouteContext();
	const router = useRouter();
	const home = firstAccessiblePath({ role: user.role, moduleIds });
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
			<ShieldOffIcon
				className="size-8 text-muted-foreground"
				aria-hidden="true"
			/>
			<h1 className="font-semibold text-lg">
				{moduleIds.length ? "你没有这个页面的访问权限" : "暂未分配功能权限"}
			</h1>
			<p className="max-w-md text-muted-foreground text-sm">
				请联系管理员调整你的功能权限。权限分配后，刷新即可进入。
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				<Button onClick={() => router.navigate({ to: "/", replace: true })}>
					刷新权限
				</Button>
				{home !== "/access-denied" && (
					<Button
						variant="outline"
						nativeButton={false}
						render={<Link to={home} />}
					>
						进入可用功能
					</Button>
				)}
			</div>
		</div>
	);
}
