/**
 * @file 注册页面的视图入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/register.tsx。
 * 调用：components/auth/auth-alt-link、components/auth/auth-header、components/auth/auth-shell、configs/app、./register-form。
 * 功能：组合认证页面壳、标题、专用表单与切换链接。
 * 预期结果：路由文件无需承载页面布局。
 */
import AuthAltLink from "@/components/auth/auth-alt-link";
import AuthHeader from "@/components/auth/auth-header";
import AuthShell from "@/components/auth/auth-shell";
import { appConfig } from "@/configs/app";
import RegisterForm from "./register-form";

const RegisterView = () => (
	<AuthShell
		showcase={{
			title: "创建账号，开始工作",
			description: "让收件箱、工单和联系人集中在同一个工作台中。",
			panelTitle: "加入你的团队",
			panelDescription: `创建 ${appConfig.name} 账号，开启你的客户服务工作。`,
		}}
	>
		<AuthHeader title="创建账号" subtitle="设置账号和密码，开始使用工作台。" />
		<div className="flex flex-col gap-4">
			<RegisterForm />
			<AuthAltLink prompt="已有账号？" linkText="登录" href="/login" />
		</div>
	</AuthShell>
);

export default RegisterView;
