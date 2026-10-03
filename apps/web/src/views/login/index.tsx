// Component Imports
import AuthAltLink from "@/components/auth/auth-alt-link";
import AuthHeader from "@/components/auth/auth-header";
import AuthShell from "@/components/auth/auth-shell";
// Config Imports
import { appConfig } from "@/lib/app-config";
import LoginForm from "./login-form";

const LoginView = () => (
	<AuthShell
		showcase={{
			title: "欢迎回来！",
			description: "在同一个工作台中管理收件箱、工单和联系人，继续你的工作。",
			panelTitle: "使用账号密码登录",
			panelDescription: `登录 ${appConfig.name}，查看最新对话、工单与动态。`,
		}}
	>
		<AuthHeader title="欢迎回来" subtitle="请输入你的账号和密码。" />
		<div className="flex flex-col gap-4">
			<LoginForm />
			<AuthAltLink prompt="还没有账号？" linkText="创建账号" href="/register" />
		</div>
	</AuthShell>
);

export default LoginView;
