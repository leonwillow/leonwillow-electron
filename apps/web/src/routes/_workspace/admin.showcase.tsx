/**
 * @file 管理中心的组件演示路由。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：在管理员权限边界内挂载组件、配色与字体实时演示页。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：TanStack Router、views/admin/showcase。
 * 功能：供管理员直观检视当前主题下的颜色令牌、排版字体与基础交互组件外观。
 * 预期结果：仅管理员可进入，普通人员由父级路由拦截并跳转无权限提示页。
 */
import { createFileRoute } from "@tanstack/react-router";
import ShowcaseView from "@/views/admin/showcase";

export const Route = createFileRoute("/_workspace/admin/showcase")({
	component: ShowcaseView,
});
