/**
 * @file 工作台路由的会话与权限边界。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、components/auth/auth-route-error、components/layout/workspace-layout、lib/access、共享权限目录。
 * 功能：进入子路由及恢复窗口时查询权限，未登录跳转，无权访问显示说明。
 * 预期结果：会话检查通过后挂载工作台；菜单与子路由共用同一份用户资料。
 */
import { canAccessPath } from "@leonwillow-electron/access";
import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import AuthRouteError from "@/components/auth/auth-route-error";
import WorkspaceLayout from "@/components/layout/workspace-layout";
import { getAccess } from "@/lib/access";

export const Route = createFileRoute("/_workspace")({
	beforeLoad: async ({ location }) => {
		const access = await getAccess();
		if (!access) throw redirect({ to: "/login", replace: true });
		if (
			!canAccessPath(
				{ role: access.user.role, moduleIds: access.moduleIds },
				location.pathname,
			)
		) {
			throw redirect({ to: "/access-denied", replace: true });
		}
		return access;
	},
	preloadStaleTime: 0,
	errorComponent: AuthRouteError,
	component: WorkspaceRoute,
});

function WorkspaceRoute() {
	const router = useRouter();
	useEffect(() => {
		const refresh = () => {
			if (document.visibilityState === "visible") void router.invalidate();
		};
		window.addEventListener("focus", refresh);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			window.removeEventListener("focus", refresh);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [router]);
	return (
		<WorkspaceLayout>
			<Outlet />
		</WorkspaceLayout>
	);
}
