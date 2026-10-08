/**
 * @file 侧栏的明暗模式切换入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-08
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、lucide-react、next-themes、stores/theme-store。
 * 功能：依据当前解析模式更新持久化主题设置。
 * 预期结果：按钮外观与实际模式同步，刷新后恢复选择。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { MoonStarIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { useThemeStore } from "@/stores/theme-store";

const ModeToggle = () => {
	const { forcedTheme, resolvedTheme } = useTheme();
	const updateSettings = useThemeStore((state) => state.updateSettings);

	return (
		<Button
			variant="ghost"
			size="icon-workspace"
			className="relative hover:bg-primary/10 hover:text-primary"
			onClick={() =>
				updateSettings({
					mode: (forcedTheme ?? resolvedTheme) === "light" ? "dark" : "light",
				})
			}
		>
			<MoonStarIcon className="scale-100 dark:scale-0" />
			<SunIcon className="absolute scale-0 dark:scale-100" />
			<span className="sr-only">切换明暗模式</span>
		</Button>
	);
};

export default ModeToggle;
