/**
 * @file 管理中心的人员与权限路由。
 * 创建时间：2026-10-04
 * 修改时间：2026-10-04
 * 版本作用：将管理功能与个人设置的路由职责分开。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：TanStack Router、管理 API、admin/users 视图。
 * 功能：在父级管理员校验后加载人员和操作记录。
 * 预期结果：管理中心显示真实数据，并提供加载和失败状态。
 */
import { createFileRoute } from "@tanstack/react-router";
import { getAdminData } from "@/lib/access";
import UsersView from "@/views/admin/users";
import {
	UsersErrorView,
	UsersPendingView,
} from "@/views/admin/users/route-states";

export const Route = createFileRoute("/_workspace/admin/users")({
	loader: getAdminData,
	staleTime: 0,
	preloadStaleTime: 0,
	component: UsersView,
	errorComponent: UsersErrorView,
	pendingComponent: UsersPendingView,
});
