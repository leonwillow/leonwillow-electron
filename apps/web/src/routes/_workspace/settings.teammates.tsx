/**
 * @file 旧人员管理地址的兼容跳转。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：TanStack Router。
 * 功能：在父级管理员校验后跳转到管理中心的人员页。
 * 预期结果：已有书签仍可使用，个人设置不承载人员管理。
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/settings/teammates")({
	beforeLoad: () => {
		throw redirect({ to: "/admin/users", replace: true });
	},
});
