/**
 * @file 常用外观设置弹层的按需加载面板内容。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-21
 * 版本作用：将重型色盘、字体选择器与预设列表从工作台首屏拆出，打开或预热时再加载。
 * 被调用：components/layout/theme-customizer.tsx。
 * 调用：ui 基础组件、next-themes、sonner、ThemeLineSettings、ThemePresetSelect、主题过渡、主题 Store、主题分析开关 Store 与字体配置。
 * 功能：组合预设、精选字体、明暗、圆角、线条、缩放、菜单外观与重置控件，并为管理员提供主题分析悬浮球开关。
 * 预期结果：保持原面板全部无障碍语义、明暗渐变过渡与即时预览持久化，普通成员不展示管理员分析开关。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Label } from "@leonwillow-electron/ui/components/label";
import { PopoverContent } from "@leonwillow-electron/ui/components/popover";
import {
	RadioGroup,
	RadioGroupSegmentedItem,
	RadioGroupTileItem,
} from "@leonwillow-electron/ui/components/radio-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { getRouteApi } from "@tanstack/react-router";
import {
	BanIcon,
	RefreshCcwIcon,
	ScanEyeIcon,
	SettingsIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ThemeLineSettings } from "@/components/layout/theme-line-settings";
import ThemePresetSelect from "@/components/theme-editor/theme-preset-select";
import {
	CURATED_FONTS,
	FONT_CONFIG,
	FONT_GROUPS,
	type FontKey,
} from "@/configs/fonts";
import { initialSettings } from "@/configs/theme-settings";
import { resolveThemeMode, runThemeTransition } from "@/lib/theme-transition";
import { useThemeInspectorStore } from "@/stores/theme-inspector-store";
import { useThemeStore } from "@/stores/theme-store";
import type { Mode, Radius, Scale, SidebarMode } from "@/types/theme";

const MODES: { value: Mode; label: string }[] = [
	{ value: "light", label: "浅色" },
	{ value: "dark", label: "深色" },
	{ value: "system", label: "跟随系统" },
];

const SCALE_MODES: { value: Scale; label: string }[] = [
	{ value: "sm", label: "小" },
	{ value: "md", label: "中" },
	{ value: "lg", label: "大" },
	{ value: "xl", label: "特大" },
];

const RADII: { value: Radius; label: string; tooltip: string }[] = [
	{ value: "none", label: "无", tooltip: "0rem" },
	{ value: "sm", label: "小", tooltip: "0.45rem" },
	{ value: "md", label: "中", tooltip: "0.625rem" },
	{ value: "lg", label: "大", tooltip: "0.875rem" },
];

const SIDEBAR_MODES: { value: SidebarMode; label: string }[] = [
	{ value: "docked", label: "贴边" },
	{ value: "wide", label: "宽菜单" },
	{ value: "floating", label: "悬浮" },
	{ value: "floating-pill", label: "悬浮时尚" },
];

const FONT_ITEMS: { label: string; value: FontKey }[] = (
	Object.entries(FONT_CONFIG) as [FontKey, (typeof FONT_CONFIG)[FontKey]][]
).map(([value, config]) => ({ label: config.label, value }));

export default function ThemeCustomizerPanel({
	mode,
	onOpenEditor,
}: {
	mode: "light" | "dark";
	onOpenEditor: () => void;
}) {
	const settings = useThemeStore((state) => state.preferences.settings);
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const role = getRouteApi("/_workspace").useRouteContext({
		select: ({ user }) => user.role,
	});
	const isAdmin = role === "admin";
	const inspectorEnabled = useThemeInspectorStore((state) => state.enabled);
	const toggleInspectorEnabled = useThemeInspectorStore(
		(state) => state.toggleEnabled,
	);
	const { forcedTheme, setTheme, systemTheme } = useTheme();
	const visibleFonts: FontKey[] = CURATED_FONTS.includes(settings.font)
		? [...CURATED_FONTS]
		: [settings.font, ...CURATED_FONTS];

	const hasChanges = (
		Object.keys(initialSettings) as (keyof typeof initialSettings)[]
	).some((key) => settings[key] !== initialSettings[key]);

	const switchColorMode = (nextMode: Mode) => {
		const commit = () => {
			updateSettings({ mode: nextMode });
			setTheme(nextMode);
		};
		if (forcedTheme) {
			commit();
			return;
		}
		runThemeTransition(mode, resolveThemeMode(nextMode, systemTheme), commit);
	};

	const resetTheme = () => {
		const previousSettings = { ...settings };
		const commit = () => {
			updateSettings(initialSettings);
			setTheme(initialSettings.mode);
		};
		if (forcedTheme) {
			commit();
		} else {
			runThemeTransition(
				mode,
				resolveThemeMode(initialSettings.mode, systemTheme),
				commit,
			);
		}
		toast.success("已恢复默认主题设置", {
			action: {
				label: "撤销",
				onClick: () => {
					const restore = () => {
						updateSettings(previousSettings);
						setTheme(previousSettings.mode);
					};
					if (forcedTheme) {
						restore();
						return;
					}
					const currentResolved = document.documentElement.classList.contains(
						"dark",
					)
						? "dark"
						: "light";
					runThemeTransition(
						currentResolved,
						resolveThemeMode(previousSettings.mode, systemTheme),
						restore,
					);
				},
			},
		});
	};

	return (
		<PopoverContent
			aria-label="主题设置"
			side="right"
			align="end"
			sideOffset={14}
			scrollable
			className="max-h-(--available-height) w-80 text-sm"
			scrollContentClassName="gap-5 px-0 py-3"
		>
			<div className="flex flex-col gap-1 px-3">
				<div className="flex items-center justify-between gap-2">
					<h3 className="shrink-0 font-medium text-lg">主题设置</h3>
					<div className="flex items-center gap-1">
						{isAdmin && (
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											size="sm"
											variant={inspectorEnabled ? "secondary" : "ghost"}
											aria-pressed={inspectorEnabled}
											onClick={toggleInspectorEnabled}
										/>
									}
								>
									<ScanEyeIcon data-icon="inline-start" aria-hidden="true" />
									主题分析
								</TooltipTrigger>
								<TooltipContent>
									{inspectorEnabled
										? "关闭主题分析悬浮球"
										: "开启主题分析悬浮球"}
								</TooltipContent>
							</Tooltip>
						)}
						<Button
							size="sm"
							variant="ghost"
							aria-label="自定义主题设置"
							onClick={onOpenEditor}
						>
							<SettingsIcon data-icon="inline-start" />
							设置
						</Button>

						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label="重置主题"
										className="relative"
										disabled={!hasChanges}
										focusableWhenDisabled
										onClick={resetTheme}
									/>
								}
							>
								<RefreshCcwIcon />
								{hasChanges && (
									<span className="absolute top-1.5 right-1.5 size-1 rounded-full bg-destructive ring-2 ring-popover">
										<span className="sr-only">主题设置已修改</span>
									</span>
								)}
							</TooltipTrigger>
							<TooltipContent>
								{hasChanges ? "重置为默认外观" : "当前已是默认外观"}
							</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-1 px-3">
				<Label htmlFor="theme-preset">主题预设</Label>
				<ThemePresetSelect
					id="theme-preset"
					value={settings.themePreset}
					mode={mode}
					onValueChange={(themePreset) => updateSettings({ themePreset })}
				/>
			</div>

			<div className="flex flex-col gap-1 px-3">
				<div className="flex items-center justify-between gap-2">
					<Label htmlFor="font">字体</Label>
					<span className="text-caption text-muted-foreground">
						主要影响英文与数字
					</span>
				</div>
				<Select
					id="font"
					items={FONT_ITEMS}
					value={settings.font}
					onValueChange={(value) => updateSettings({ font: value as FontKey })}
				>
					<SelectTrigger className="w-full">
						<span
							className="flex-1 text-left"
							style={{
								fontFamily: `var(${FONT_CONFIG[settings.font]?.variable ?? "--font-public-sans"})`,
							}}
						>
							{FONT_CONFIG[settings.font]?.label ?? "Public Sans"}
						</span>
					</SelectTrigger>
					<SelectContent>
						{FONT_GROUPS.map(({ key: groupKey, label: groupLabel }) => {
							const fonts = visibleFonts
								.map((key) => [key, FONT_CONFIG[key]] as const)
								.filter(([, config]) => config.group === groupKey);

							if (fonts.length === 0) return null;

							return (
								<SelectGroup key={groupKey}>
									<SelectLabel>{groupLabel}</SelectLabel>
									{fonts.map(([key, config]) => (
										<SelectItem
											key={key}
											value={key}
											className="[&>div]:items-center"
										>
											<span style={{ fontFamily: `var(${config.variable})` }}>
												{config.label}
											</span>
										</SelectItem>
									))}
								</SelectGroup>
							);
						})}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1 px-3">
				<span
					id="color-mode-label"
					className="font-medium text-xs leading-none"
				>
					颜色模式
				</span>
				<RadioGroup
					aria-labelledby="color-mode-label"
					variant="segmented"
					size="default"
					className="grid-cols-3"
					value={settings.mode}
					onValueChange={(v) => switchColorMode(v as Mode)}
				>
					{MODES.map(({ value, label }) => (
						<RadioGroupSegmentedItem
							key={value}
							id={`mode-${value}`}
							value={value}
							aria-label={label}
						>
							{label}
						</RadioGroupSegmentedItem>
					))}
				</RadioGroup>
			</div>

			<div className="flex flex-col gap-1 px-3">
				<span id="radius-label" className="font-medium text-xs leading-none">
					圆角
				</span>
				<RadioGroup
					aria-labelledby="radius-label"
					variant="segmented"
					size="default"
					className="grid-cols-4"
					value={settings.radius}
					onValueChange={(v) => updateSettings({ radius: v as Radius })}
				>
					{RADII.map(({ value, label, tooltip }) => (
						<Tooltip key={value}>
							<TooltipTrigger
								render={
									<RadioGroupSegmentedItem
										id={`radius-${value}`}
										value={value}
										aria-label={label}
									>
										{value === "none" ? <BanIcon aria-hidden="true" /> : label}
									</RadioGroupSegmentedItem>
								}
							/>
							<TooltipContent>{tooltip}</TooltipContent>
						</Tooltip>
					))}
				</RadioGroup>
			</div>

			<ThemeLineSettings key={mode} mode={mode} />

			<div className="flex flex-col gap-1 px-3">
				<span id="scale-label" className="font-medium text-xs leading-none">
					界面缩放
				</span>
				<RadioGroup
					aria-labelledby="scale-label"
					variant="segmented"
					size="default"
					className="grid-cols-4"
					value={settings.scale}
					onValueChange={(v) => updateSettings({ scale: v as Scale })}
				>
					{SCALE_MODES.map((item) => (
						<RadioGroupSegmentedItem
							key={item.value}
							id={`scale-${item.value}`}
							value={item.value}
							aria-label={item.label}
						>
							{item.label}
						</RadioGroupSegmentedItem>
					))}
				</RadioGroup>
			</div>

			<div className="flex flex-col gap-1 px-3">
				<span
					id="sidebar-mode-label"
					className="font-medium text-xs leading-none"
				>
					菜单外观
				</span>
				<RadioGroup
					aria-labelledby="sidebar-mode-label"
					variant="grid"
					size="default"
					className="grid-cols-2"
					value={settings.sidebarMode}
					onValueChange={(value) =>
						updateSettings({ sidebarMode: value as SidebarMode })
					}
				>
					{SIDEBAR_MODES.map(({ value, label }) => (
						<RadioGroupTileItem
							key={value}
							id={`sidebar-${value}`}
							value={value}
							aria-label={label}
						>
							{label}
						</RadioGroupTileItem>
					))}
				</RadioGroup>
			</div>
		</PopoverContent>
	);
}
