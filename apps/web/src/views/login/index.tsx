/**
 * @file 登录页面的视图入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/login.tsx。
 * 调用：components/auth/auth-header、components/auth/auth-shell、configs/app、./login-form。
 * 功能：组合认证页面壳、标题、登录表单与管理员开通说明。
 * 预期结果：路由文件无需承载页面布局，展示文案与真实工作台模块保持一致。
 */
import AuthHeader from "@/components/auth/auth-header";
import AuthShell from "@/components/auth/auth-shell";
import { appConfig } from "@/configs/app";
import LoginForm from "./login-form";

export default function LoginView() {
	return (
		<AuthShell
			showcase={{
				title: "欢迎回来",
				description:
					"在一个工作台中协同完成资金分析、文书取号、询问笔录与税款测算。",
				panelTitle: "内部工作台登录",
				panelDescription: `登录 ${appConfig.name}，按已分配的功能权限安全访问业务资料。`,
			}}
		>
			<AuthHeader title="欢迎回来" />
			<div className="flex flex-col gap-4">
				<LoginForm />
				<p className="text-center text-muted-foreground text-xs">
					账号由管理员统一创建。如需开通，请联系管理员。
				</p>
			</div>
		</AuthShell>
	);
}
