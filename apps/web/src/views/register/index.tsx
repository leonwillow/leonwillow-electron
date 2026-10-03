// Component Imports
import AuthAltLink from "@/components/auth/auth-alt-link";
import AuthHeader from "@/components/auth/auth-header";
import AuthShell from "@/components/auth/auth-shell";
// Config Imports
import { appConfig } from "@/lib/app-config";
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
