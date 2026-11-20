/**
 * @file 路由树的根节点。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、components/layout/root-layout、components/layout/async-state。
 * 功能：挂载应用根布局并提供未匹配路由的中文兜底视图。
 * 预期结果：主题与全局提示覆盖所有路由，无效地址展示可返回的 404 提示而非空白页。
 */
import { createRootRoute } from "@tanstack/react-router";
import { WorkspaceNotFound } from "@/components/layout/async-state";
import RootLayout from "@/components/layout/root-layout";

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: WorkspaceNotFound,
});
