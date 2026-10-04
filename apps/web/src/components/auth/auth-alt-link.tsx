/**
 * @file 登录与注册之间的切换提示。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：views/register/index.tsx、views/login/index.tsx。
 * 调用：@tanstack/react-router。
 * 功能：组合提示文案和受路由约束的文本链接。
 * 预期结果：用户能在两个认证页面之间导航。
 */
import { Link } from "@tanstack/react-router";

const AuthAltLink = ({
	prompt,
	linkText,
	href,
}: {
	prompt: string;
	linkText: string;
	href: "/login" | "/register";
}) => (
	<p className="text-center text-muted-foreground text-sm">
		{prompt}{" "}
		<Link to={href} className="text-foreground hover:underline">
			{linkText}
		</Link>
	</p>
);

export default AuthAltLink;
