/**
 * @file 侧栏的明暗模式切换入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、Arc SunMoonIcon、next-themes、stores/theme-store、lib/theme-transition。
 * 功能：依据当前解析模式更新持久化主题，形变图标并从左向右渐变切换页面；宽菜单下附带标签与当前模式。
 * 预期结果：图标与页面连续过渡，保留主题偏好及减少动态效果支持。
 */
import { SunMoonIcon } from "@leonwillow-electron/ui/components/arc/icon-morph/icon-morph";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useTheme } from "next-themes";

import { toggleThemeTransition } from "@/lib/theme-transition";
import { useThemeStore } from "@/stores/theme-store";

const ModeToggle = ({ wide = false }: { wide?: boolean }) => {
	const { forcedTheme, resolvedTheme, setTheme } = useTheme();
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const dark = (forcedTheme ?? resolvedTheme) === "dark";

	return (
		<Tooltip disabled={wide}>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size={wide ? "lg" : "icon-workspace"}
						className={cn(
							"workspace-nav-item",
							wide && "w-full justify-start gap-2.5 px-2.5",
						)}
						aria-label={wide ? undefined : "切换明暗模式"}
						aria-pressed={dark}
						onClick={() =>
							toggleThemeTransition(dark ? "dark" : "light", (mode) => {
								updateSettings({ mode });
								setTheme(mode);
							})
						}
					/>
				}
			>
				<SunMoonIcon state={dark} />
				{wide && (
					<>
						<span className="min-w-0 flex-1 truncate text-left">明暗模式</span>
						<span className="shrink-0 text-caption text-muted-foreground">
							{dark ? "深色" : "浅色"}
						</span>
					</>
				)}
			</TooltipTrigger>
			<TooltipContent side="right">切换明暗模式</TooltipContent>
		</Tooltip>
	);
};

export default ModeToggle;
