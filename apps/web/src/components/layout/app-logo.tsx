/**
 * @file 带工作台链接的品牌组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-05
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/auth/auth-header.tsx、components/layout/app-sidebar.tsx。
 * 调用：ui/lib/utils、@tanstack/react-router、assets/svg/logo、configs/app。
 * 功能：组合品牌图标与可选名称。
 * 预期结果：点击品牌进入当前用户可访问的首个功能，图标链接具备可访问名称。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import IconLogo from "@/assets/svg/logo";
import { appConfig } from "@/configs/app";

const AppLogo = ({
	showName = false,
	className,
	variant = "default",
}: {
	showName?: boolean;
	className?: string;
	variant?: "default" | "rail";
}) => {
	return (
		<Link
			to="/"
			className={cn("flex items-center gap-2", className)}
			aria-label={appConfig.name}
		>
			<span
				className={cn(
					"flex items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground",
					variant === "rail" ? "size-workspace-icon" : "size-9",
				)}
			>
				<IconLogo className="block size-full" />
			</span>
			{showName && (
				<span className="font-semibold text-lg md:text-2xl">
					{appConfig.name}
				</span>
			)}
		</Link>
	);
};

export default AppLogo;
