/**
 * @file 管理中心的组件、颜色与字体综合演示页面。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：为管理员提供直观检视全局色板、排版字体与基础交互组件的统一页面，并内置快捷主题切换与编辑器入口。
 * 被调用：routes/_workspace/admin.showcase.tsx。
 * 调用：WorkspaceHeader/WorkspaceTitle、共享 UI、next-themes、主题 Store、预设目录及四个演示分区。
 * 功能：顶部展示当前生效主题与快捷切换工具，正文支持全部展示或按分类聚焦查看。
 * 预期结果：切换主题、明暗模式或调整主题编辑器时，页面内所有色块、字体与组件即时响应更新。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import {
	MoonIcon,
	PaletteIcon,
	SlidersHorizontalIcon,
	SunIcon,
	SwatchBookIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";
import { type ThemePresetKey, themePresets } from "@/configs/theme-presets";
import { toggleThemeTransition } from "@/lib/theme-transition";
import { useThemeStore } from "@/stores/theme-store";
import type { Settings } from "@/types/theme";
import ColorTokensSection from "./color-tokens-section";
import ControlsSection from "./controls-section";
import OverlaysAndDataSection from "./overlays-and-data-section";
import TypographySection from "./typography-section";

type ShowcaseCategory =
	| "all"
	| "colors"
	| "typography"
	| "controls"
	| "overlays";

type BuiltInPresetKey = Exclude<ThemePresetKey, "default">;
const BUILTIN_PRESET_KEYS = Object.keys(themePresets) as BuiltInPresetKey[];

export default function ShowcaseView() {
	const [category, setCategory] = useState<ShowcaseCategory>("all");
	const editorTriggerRef = useRef<HTMLButtonElement>(null);
	const { forcedTheme, resolvedTheme, setTheme } = useTheme();
	const preferences = useThemeStore((state) => state.preferences);
	const previewMode = useThemeStore((state) => state.preview?.mode ?? null);
	const previewing = previewMode !== null;
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const setThemeEditorOpen = useThemeStore((state) => state.setThemeEditorOpen);

	const isDark = (previewMode ?? forcedTheme ?? resolvedTheme) === "dark";
	const activeCustomThemes = preferences.customThemes.filter(
		(theme) => !theme.deletedAt,
	);
	const currentPreset = preferences.settings.themePreset;
	const currentPresetLabel =
		currentPreset === "default"
			? "默认主题"
			: currentPreset in themePresets
				? themePresets[currentPreset as BuiltInPresetKey].label
				: (activeCustomThemes.find((t) => t.id === currentPreset)?.label ??
					"自定义主题");

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<WorkspaceHeader className="justify-between">
				<div className="flex min-w-0 items-center gap-2.5">
					<WorkspaceTitle icon={SwatchBookIcon}>组件演示</WorkspaceTitle>
					<Badge variant="outline" className="hidden sm:inline-flex">
						{isDark ? "深色模式" : "浅色模式"}
					</Badge>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<Select
						value={currentPreset}
						onValueChange={(value) => {
							if (value)
								updateSettings({
									themePreset: value as Settings["themePreset"],
								});
						}}
					>
						<SelectTrigger
							size="sm"
							aria-label="快捷切换主题预设"
							className="w-36 sm:w-44"
						>
							<PaletteIcon aria-hidden="true" />
							<SelectValue>{currentPresetLabel}</SelectValue>
						</SelectTrigger>
						<SelectContent align="end">
							<SelectGroup>
								<SelectLabel>内置主题</SelectLabel>
								<SelectItem value="default">默认主题</SelectItem>
								{BUILTIN_PRESET_KEYS.map((key) => (
									<SelectItem key={key} value={key}>
										{themePresets[key].label}
									</SelectItem>
								))}
							</SelectGroup>
							{activeCustomThemes.length > 0 && (
								<>
									<SelectSeparator />
									<SelectGroup>
										<SelectLabel>自定义主题</SelectLabel>
										{activeCustomThemes.map((theme) => (
											<SelectItem key={theme.id} value={theme.id}>
												{theme.label}
											</SelectItem>
										))}
									</SelectGroup>
								</>
							)}
						</SelectContent>
					</Select>

					<TooltipIconButton
						label={isDark ? "切换到浅色模式" : "切换到深色模式"}
						disabled={previewing}
						disabledReason="主题预览期间请在主题编辑器内切换明暗"
						size="icon-sm"
						variant="outline"
						onClick={() => {
							if (previewing) return;
							toggleThemeTransition(isDark ? "dark" : "light", (mode) => {
								updateSettings({ mode });
								setTheme(mode);
							});
						}}
					>
						{isDark ? (
							<SunIcon aria-hidden="true" />
						) : (
							<MoonIcon aria-hidden="true" />
						)}
					</TooltipIconButton>

					<Button
						ref={editorTriggerRef}
						type="button"
						size="sm"
						variant="outline"
						onClick={() => setThemeEditorOpen(true, editorTriggerRef)}
					>
						<SlidersHorizontalIcon aria-hidden="true" />
						<span className="hidden sm:inline">主题编辑器</span>
					</Button>
				</div>
			</WorkspaceHeader>

			<div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-workspace-gutter py-2">
				<div className="no-scrollbar min-w-0 max-w-full overflow-x-auto">
					<Tabs
						value={category}
						onValueChange={(value) => setCategory(value as ShowcaseCategory)}
					>
						<TabsList>
							<TabsTrigger value="all">全部展示</TabsTrigger>
							<TabsTrigger value="colors">颜色与令牌</TabsTrigger>
							<TabsTrigger value="typography">字体与排版</TabsTrigger>
							<TabsTrigger value="controls">按钮与表单</TabsTrigger>
							<TabsTrigger value="overlays">数据与弹层</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<span className="hidden shrink-0 text-caption text-muted-foreground md:inline">
					仅管理员可见 · 修改主题或字体实时生效
				</span>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 md:p-6">
					{(category === "all" || category === "colors") && (
						<ColorTokensSection />
					)}
					{(category === "all" || category === "typography") && (
						<TypographySection />
					)}
					{(category === "all" || category === "controls") && (
						<ControlsSection />
					)}
					{(category === "all" || category === "overlays") && (
						<OverlaysAndDataSection />
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
