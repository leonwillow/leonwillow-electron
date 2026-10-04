/**
 * @file 路由树的根节点。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、components/layout/root-layout。
 * 功能：挂载应用根布局并提供未匹配路由的出口。
 * 预期结果：主题与全局提示覆盖所有路由。
 */
import { createRootRoute } from "@tanstack/react-router";
import RootLayout from "@/components/layout/root-layout";

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: () => null,
});
