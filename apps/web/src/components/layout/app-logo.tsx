/**
 * @file 带工作台跳转的品牌组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-19
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/auth/auth-header.tsx、components/layout/app-sidebar.tsx。
 * 调用：ui/lib/utils、@tanstack/react-router、assets/svg/logo、configs/app。
 * 功能：组合品牌图标与可选名称。
 * 预期结果：点击品牌进入当前用户可访问的首个功能，图标具备可访问名称且不触发浏览器底部链接预览。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
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
	const navigate = useNavigate();
	return (
		<button
			type="button"
			onClick={() => void navigate({ to: "/" })}
			className={cn(
				"flex min-w-0 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
				variant === "rail" && "rounded-lg",
				className,
			)}
			aria-label={appConfig.name}
		>
			<span
				data-slot="app-logo-mark"
				className={cn(
					"flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground",
					variant === "rail" ? "size-workspace-icon" : "size-9",
				)}
			>
				<IconLogo className="block size-full" />
			</span>
			{showName &&
				(variant === "rail" ? (
					<span className="flex min-w-0 flex-col">
						<span className="truncate font-semibold text-sidebar-foreground text-sm leading-tight">
							{appConfig.name}
						</span>
						<span className="truncate text-caption text-muted-foreground leading-tight">
							{appConfig.workspaceName}
						</span>
					</span>
				) : (
					<span className="font-semibold text-lg md:text-2xl">
						{appConfig.name}
					</span>
				))}
		</button>
	);
};

export default AppLogo;
