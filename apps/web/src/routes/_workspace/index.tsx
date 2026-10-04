/**
 * @file 工作台默认地址的重定向。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：CSR 文件路由契约，由路由生成器收集。
 * 被调用：TanStack Router 生成的路由树。
 * 调用：@tanstack/react-router。
 * 功能：把 / 跳转到收件箱入口。
 * 预期结果：默认地址与侧栏的首个工作入口一致。
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/")({
	beforeLoad: () => {
		throw redirect({ to: "/inbox" });
	},
});
