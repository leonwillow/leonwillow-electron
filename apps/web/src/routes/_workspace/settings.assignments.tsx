/**
 * @file /settings/assignments 的预留路由出口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router。
 * 功能：保留现有导航目标，组件暂时返回 null。
 * 预期结果：页面迁移前显示空内容；不生成占位业务数据。
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/settings/assignments")({
	component: () => null,
});
