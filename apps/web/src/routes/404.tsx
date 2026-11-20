/**
 * @file /404 页面路由。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router、components/layout/async-state。
 * 功能：呈现统一 404 兜底视图并提供返回工作台入口。
 * 预期结果：访问 /404 时显示清晰的未找到提示而非白屏。
 */
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceNotFound } from "@/components/layout/async-state";

export const Route = createFileRoute("/404")({
	component: WorkspaceNotFound,
});
