/**
 * @file 常用外观设置弹层的按需加载面板内容。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-19
 * 版本作用：将重型色盘、字体选择器与预设列表从工作台首屏拆出，打开或预热时再加载。
 * 被调用：components/layout/theme-customizer.tsx。
 * 调用：ui 基础组件、next-themes、ThemeLineSettings、ThemePresetSelect、主题过渡、主题 Store 与字体配置。
 * 功能：组合预设、字体、明暗、圆角、线条、缩放、菜单外观及重置控件。
 * 预期结果：保持原面板全部无障碍语义、明暗渐变过渡、即时预览持久化与编辑器跳转行为。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Label } from "@leonwillow-electron/ui/components/label";
import { PopoverContent } from "@leonwillow-electron/ui/components/popover";
import {
	RadioGroup,
	RadioGroupSegmentedItem,
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
import {
	BanIcon,
	CircleQuestionMarkIcon,
	RefreshCcwIcon,
	SettingsIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeLineSettings } from "@/components/layout/theme-line-settings";
import ThemePresetSelect from "@/components/theme-editor/theme-preset-select";
import { FONT_CONFIG, FONT_GROUPS, type FontKey } from "@/configs/fonts";
import { initialSettings } from "@/configs/theme-settings";
import { resolveThemeMode, runThemeTransition } from "@/lib/theme-transition";
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
	const { forcedTheme, setTheme, systemTheme } = useTheme();

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
		const commit = () => {
			updateSettings(initialSettings);
			setTheme(initialSettings.mode);
		};
		if (forcedTheme) {
			commit();
			return;
		}
		runThemeTransition(
			mode,
			resolveThemeMode(initialSettings.mode, systemTheme),
			commit,
		);
	};

	return (
		<PopoverContent
			aria-label="主题设置"
			align="end"
			sideOffset={8}
			scrollable
			className="max-h-[calc(100vh-10rem)] w-72 text-sm"
			scrollContentClassName="gap-5 px-0 py-3"
		>
			<div className="flex flex-col gap-1 px-3">
				<div className="flex items-center justify-between">
					<h3 className="font-medium text-lg">主题设置</h3>
					<div className="flex items-center gap-2">
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
										aria-label="主题帮助"
									/>
								}
							>
								<CircleQuestionMarkIcon />
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-62">
								<p>
									查看
									<a
										href="https://shadcnstudio.com/docs/documentation-admin/customization#theme-config"
										target="_blank"
										className="inline font-medium underline"
										rel="noopener"
									>
										主题文档
									</a>{" "}
									了解详细的主题设置说明。
								</p>
							</TooltipContent>
						</Tooltip>

						<Button
							size="icon-sm"
							variant="ghost"
							aria-label="重置主题"
							className="relative"
							onClick={resetTheme}
						>
							<RefreshCcwIcon />
							{hasChanges && (
								<span className="absolute top-1.5 right-1.5 size-1 rounded-full bg-destructive ring-2 ring-popover">
									<span className="sr-only">主题设置已修改</span>
								</span>
							)}
						</Button>
					</div>
				</div>
				<p className="text-muted-foreground text-sm">按照你的喜好调整主题。</p>
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
				<Label htmlFor="font">字体</Label>
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
							const fonts = (
								Object.entries(FONT_CONFIG) as [
									FontKey,
									(typeof FONT_CONFIG)[FontKey],
								][]
							).filter(([, config]) => config.group === groupKey);

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
				<Label htmlFor="color-mode">颜色模式</Label>
				<RadioGroup
					id="color-mode"
					aria-label="颜色模式"
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
				<Label htmlFor="radius">圆角</Label>
				<RadioGroup
					id="radius"
					aria-label="圆角"
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
				<Label htmlFor="scale">界面缩放</Label>
				<RadioGroup
					id="scale"
					aria-label="界面缩放"
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
				<Label htmlFor="sidebar-mode">菜单外观</Label>
				<RadioGroup
					id="sidebar-mode"
					aria-label="菜单外观"
					variant="segmented"
					size="default"
					className="grid-cols-3"
					value={settings.sidebarMode}
					onValueChange={(value) =>
						updateSettings({ sidebarMode: value as SidebarMode })
					}
				>
					{SIDEBAR_MODES.map(({ value, label }) => (
						<RadioGroupSegmentedItem
							key={value}
							id={`sidebar-${value}`}
							value={value}
							aria-label={label}
						>
							{label}
						</RadioGroupSegmentedItem>
					))}
				</RadioGroup>
			</div>
		</PopoverContent>
	);
}
