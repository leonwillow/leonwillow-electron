/**
 * @file 常用外观设置的轻量入口触发器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-20
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现，弹层内容按需懒加载。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础触发器组件、next-themes、主题 Store、按需加载的 ThemeCustomizerPanel。
 * 功能：提供侧栏调色入口与悬停预热，宽菜单下展示带文字标签的横向行，首次打开时挂载完整主题设置弹层。
 * 预期结果：工作台首屏不打入重型色盘与预设代码，切换侧栏外观不卸载弹层。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Popover,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { PaletteIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { lazy, Suspense, useRef, useState } from "react";
import { useThemeStore } from "@/stores/theme-store";

const loadThemeCustomizerPanel = () => import("./theme-customizer-panel");
const ThemeCustomizerPanel = lazy(loadThemeCustomizerPanel);

const ThemeCustomizer = ({ wide = false }: { wide?: boolean }) => {
	const setThemeEditorOpen = useThemeStore((state) => state.setThemeEditorOpen);
	const themeEditorTrigger = useRef<HTMLButtonElement>(null);
	const { forcedTheme, resolvedTheme } = useTheme();

	const mode = (forcedTheme ?? resolvedTheme) === "dark" ? "dark" : "light";

	const [open, setOpen] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const warmUp = () => {
		void loadThemeCustomizerPanel();
	};

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) setLoaded(true);
				setOpen(nextOpen);
			}}
		>
			<Tooltip disabled={wide}>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button
									ref={themeEditorTrigger}
									className={cn(
										"workspace-nav-item",
										wide && "w-full justify-start gap-2.5 px-2.5",
									)}
									variant="ghost"
									size={wide ? "lg" : "icon-workspace"}
									aria-label={wide ? undefined : "主题设置"}
									onPointerEnter={warmUp}
									onFocus={warmUp}
								/>
							}
						/>
					}
				>
					<PaletteIcon aria-hidden="true" />
					{wide && (
						<span className="min-w-0 flex-1 truncate text-left">主题设置</span>
					)}
				</TooltipTrigger>
				<TooltipContent side="right">主题设置</TooltipContent>
			</Tooltip>

			{(loaded || open) && (
				<Suspense fallback={null}>
					<ThemeCustomizerPanel
						mode={mode}
						onOpenEditor={() => {
							setOpen(false);
							setThemeEditorOpen(true, themeEditorTrigger);
						}}
					/>
				</Suspense>
			)}
		</Popover>
	);
};

export default ThemeCustomizer;
