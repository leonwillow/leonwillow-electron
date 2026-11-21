/**
 * @file 工作台路由的会话与权限边界。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、components/auth/auth-route-error、components/layout/workspace-layout、lib/access、共享权限目录。
 * 功能：进入子路由及恢复窗口时静默核验会话与权限，仅在确认失效或权限变化时跳转/刷新，临时断网保留工作台与草稿。
 * 预期结果：会话检查通过后挂载工作台；切回窗口遇瞬断绝不卸载编辑器丢失未保存草稿。
 */
import { canAccessPath } from "@leonwillow-electron/access";
import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import AuthRouteError from "@/components/auth/auth-route-error";
import WorkspaceLayout from "@/components/layout/workspace-layout";
import { getAccess, sameAccessSnapshot } from "@/lib/access";

const FOCUS_REFRESH_COOLDOWN_MS = 500;

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
	const currentAccess = Route.useRouteContext();
	const currentAccessRef = useRef(currentAccess);
	currentAccessRef.current = currentAccess;
	useEffect(() => {
		let disposed = false;
		let checkId = 0;
		let lastRefreshAt = 0;
		const refresh = () => {
			if (document.visibilityState !== "visible") return;
			const now = Date.now();
			if (now - lastRefreshAt < FOCUS_REFRESH_COOLDOWN_MS) return;
			lastRefreshAt = now;
			const id = ++checkId;
			void getAccess({ force: true })
				.then((next) => {
					if (disposed || id !== checkId) return;
					if (!next) {
						void router.navigate({
							to: "/login",
							replace: true,
							ignoreBlocker: true,
						});
						return;
					}
					if (
						!canAccessPath(
							{ role: next.user.role, moduleIds: next.moduleIds },
							router.state.location.pathname,
						) ||
						!sameAccessSnapshot(currentAccessRef.current, next)
					) {
						void router.invalidate();
					}
				})
				.catch(() => {
					// 临时网络抖动保留当前工作台与未保存草稿。
				});
		};
		window.addEventListener("focus", refresh);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			disposed = true;
			checkId += 1;
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
