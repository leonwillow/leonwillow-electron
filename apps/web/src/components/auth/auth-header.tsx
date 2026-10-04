/**
 * @file 认证页面的品牌与标题区域。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/register/index.tsx、views/login/index.tsx。
 * 调用：components/layout/app-logo。
 * 功能：接收页面标题和说明，组合可点击品牌。
 * 预期结果：登录和注册保持一致的标题层级。
 */
import AppLogo from "@/components/layout/app-logo";

const AuthHeader = ({
	title,
	subtitle,
}: {
	title: string;
	subtitle: string;
}) => (
	<div className="flex flex-col gap-6">
		<AppLogo showName />
		<div>
			<h1 className="mb-2 font-semibold text-2xl">{title}</h1>
			<p className="text-muted-foreground">{subtitle}</p>
		</div>
	</div>
);

export default AuthHeader;
