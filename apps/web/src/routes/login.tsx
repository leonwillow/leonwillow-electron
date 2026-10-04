/**
 * @file /login 的页面路由。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、views/login。
 * 功能：仅关联认证视图，不在路由文件中实现表单。
 * 预期结果：认证页使用根布局，可独立于工作台打开。
 */
import { createFileRoute } from "@tanstack/react-router";
import LoginView from "@/views/login";

export const Route = createFileRoute("/login")({
	component: LoginView,
});
