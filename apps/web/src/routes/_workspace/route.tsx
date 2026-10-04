/**
 * @file 工作台路由的会话边界。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、components/auth/auth-route-error、components/layout/workspace-layout、lib/auth。
 * 功能：进入子路由前查询会话，未登录跳转，服务故障显示错误视图。
 * 预期结果：会话检查通过后挂载工作台；菜单与子路由共用同一份用户资料。
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import AuthRouteError from "@/components/auth/auth-route-error";
import WorkspaceLayout from "@/components/layout/workspace-layout";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/_workspace")({
	beforeLoad: async () => {
		const user = await getSession();
		if (!user) throw redirect({ to: "/login", replace: true });
		return { user };
	},
	errorComponent: AuthRouteError,
	component: WorkspaceRoute,
});

function WorkspaceRoute() {
	return (
		<WorkspaceLayout>
			<Outlet />
		</WorkspaceLayout>
	);
}
