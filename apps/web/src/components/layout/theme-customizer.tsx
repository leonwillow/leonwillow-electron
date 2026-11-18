/**
 * @file 常用外观设置的轻量入口触发器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-18
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现，弹层内容按需懒加载。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础触发器组件、next-themes、主题 Store、按需加载的 ThemeCustomizerPanel。
 * 功能：提供侧栏调色入口与悬停预热，首次打开时挂载完整主题设置弹层。
 * 预期结果：工作台首屏不打入重型色盘与预设代码，打开交互及编辑器焦点回退保持不变。
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
import { PaletteIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { lazy, Suspense, useRef, useState } from "react";
import { useThemeStore } from "@/stores/theme-store";

const loadThemeCustomizerPanel = () => import("./theme-customizer-panel");
const ThemeCustomizerPanel = lazy(loadThemeCustomizerPanel);

const ThemeCustomizer = () => {
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
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button
									ref={themeEditorTrigger}
									className="workspace-nav-item"
									variant="ghost"
									size="icon-workspace"
									aria-label="自定义主题"
									onPointerEnter={warmUp}
									onFocus={warmUp}
								/>
							}
						/>
					}
				>
					<PaletteIcon />
				</TooltipTrigger>
				<TooltipContent side="right">自定义主题</TooltipContent>
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
