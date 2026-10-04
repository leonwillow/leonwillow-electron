/**
 * @file 登录和注册共用的页面容器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/register/index.tsx、views/login/index.tsx。
 * 调用：react、./auth-showcase。
 * 功能：组合表单栏和宽屏展示面板。
 * 预期结果：窄屏集中显示表单，宽屏保留双栏布局。
 */
import type { ReactNode } from "react";
import type { AuthShowcaseContent } from "./auth-showcase";
import AuthShowcase from "./auth-showcase";

const AuthShell = ({
	children,
	showcase,
}: {
	children: ReactNode;
	showcase: AuthShowcaseContent;
}) => (
	<div className="min-h-dvh lg:grid lg:grid-cols-2">
		<div className="flex min-h-dvh items-center justify-center sm:px-6 md:px-8">
			<div className="flex w-full flex-col gap-6 p-6 sm:max-w-lg">
				{children}
			</div>
		</div>
		<AuthShowcase {...showcase} />
	</div>
);

export default AuthShell;
