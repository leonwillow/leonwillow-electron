/**
 * @file /login 的页面路由。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、@leonwillow-electron/access、lib/access、views/login。
 * 功能：已有有效会话时直接进入首个获授权功能页；未登录或服务暂不可达时渲染登录页。
 * 预期结果：认证页使用根布局，桌面端“记住我”与切服返回均能自动恢复有效会话。
 */
import { firstAccessiblePath } from "@leonwillow-electron/access";
import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { getAccess } from "@/lib/access";
import LoginView from "@/views/login";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		try {
			const access = await getAccess();
			if (access) {
				throw redirect({
					to: firstAccessiblePath({
						role: access.user.role,
						moduleIds: access.moduleIds,
					}),
					replace: true,
				});
			}
		} catch (error) {
			if (isRedirect(error)) throw error;
			// 服务不可达时保留登录页，便于桌面端修改服务器配置或重试。
		}
	},
	component: LoginView,
});
