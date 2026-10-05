/**
 * @file 原注册地址的关闭说明。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/register.tsx。
 * 调用：components/auth/auth-alt-link、components/auth/auth-header、components/auth/auth-shell。
 * 功能：说明账号由管理员开通，并提供登录链接。
 * 预期结果：旧注册链接不再提供自行注册表单。
 */
import AuthAltLink from "@/components/auth/auth-alt-link";
import AuthHeader from "@/components/auth/auth-header";
import AuthShell from "@/components/auth/auth-shell";

const RegisterView = () => (
	<AuthShell
		showcase={{
			title: "统一账号，进入工作台",
			description: "账号和功能权限由管理员统一分配。",
			panelTitle: "联系管理员开通",
			panelDescription: "开通后，使用分配的账号和密码登录。",
		}}
	>
		<AuthHeader
			title="系统不开放自行注册"
			subtitle="请联系管理员创建账号并分配功能权限。"
		/>
		<div className="flex flex-col gap-4">
			<AuthAltLink prompt="已有账号？" linkText="登录" href="/login" />
		</div>
	</AuthShell>
);

export default RegisterView;
