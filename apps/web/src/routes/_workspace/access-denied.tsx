/**
 * @file 已登录但未获功能授权的路由。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：提供明确的访问拒绝出口。
 * 被调用：工作台权限边界。
 * 调用：TanStack Router、AccessDeniedView。
 * 功能：挂载权限说明视图；预期结果：无授权人员不会进入空白页面或重定向循环。
 */
import { createFileRoute } from "@tanstack/react-router";
import AccessDeniedView from "@/views/access-denied";
export const Route = createFileRoute("/_workspace/access-denied")({
	component: AccessDeniedView,
});
