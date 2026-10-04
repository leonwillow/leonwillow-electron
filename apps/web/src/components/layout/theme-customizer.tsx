/**
 * @file 常用外观设置的轻量入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/app-sidebar.tsx。
 * 调用：ui 基础组件/样式、lucide-react、next-themes、react、components/theme-editor/theme-preset-select、configs/fonts、configs/theme-settings、stores/theme-store、types/theme。
 * 功能：组合预设、字体、明暗、圆角、缩放及重置控件。
 * 预期结果：修改即时应用并持久化，可打开完整主题编辑器。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	RadioGroup,
	RadioGroupItem,
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
	PaletteIcon,
	RefreshCcwIcon,
	SettingsIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import ThemePresetSelect from "@/components/theme-editor/theme-preset-select";
import { FONT_CONFIG, FONT_GROUPS, type FontKey } from "@/configs/fonts";

import { initialSettings } from "@/configs/theme-settings";
import { useThemeStore } from "@/stores/theme-store";
import type { Mode, Radius, Scale } from "@/types/theme";

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

const FONT_ITEMS: { label: string; value: FontKey }[] = (
	Object.entries(FONT_CONFIG) as [FontKey, (typeof FONT_CONFIG)[FontKey]][]
).map(([value, config]) => ({ label: config.label, value }));

const ThemeCustomizer = () => {
	const settings = useThemeStore((state) => state.preferences.settings);
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const setThemeEditorOpen = useThemeStore((state) => state.setThemeEditorOpen);
	const themeEditorTrigger = useRef<HTMLButtonElement>(null);
	const { forcedTheme, resolvedTheme } = useTheme();

	const mode = (forcedTheme ?? resolvedTheme) === "dark" ? "dark" : "light";

	const hasChanges = (
		Object.keys(initialSettings) as (keyof typeof initialSettings)[]
	).some((key) => settings[key] !== initialSettings[key]);

	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						ref={themeEditorTrigger}
						className="hover:bg-primary/10 hover:text-primary"
						variant="ghost"
						size="icon-lg"
					/>
				}
			>
				<PaletteIcon />
				<span className="sr-only">自定义主题</span>
			</PopoverTrigger>

			<PopoverContent
				aria-label="主题设置"
				align="end"
				sideOffset={8}
				className="max-h-[calc(100vh-10rem)] w-72 gap-5 overflow-y-auto px-0 py-3 text-sm"
			>
				<div className="flex flex-col gap-1 px-3">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-lg">主题设置</h3>
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="ghost"
								aria-label="自定义主题设置"
								onClick={() => {
									setOpen(false);
									setThemeEditorOpen(true, themeEditorTrigger);
								}}
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
								onClick={() => updateSettings(initialSettings)}
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
					<p className="text-muted-foreground text-sm">
						按照你的喜好调整主题。
					</p>
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
						onValueChange={(value) =>
							updateSettings({ font: value as FontKey })
						}
					>
						<SelectTrigger size="lg" className="w-full">
							<span
								className="flex-1 text-left"
								style={{
									fontFamily: `var(${FONT_CONFIG[settings.font]?.variable ?? "--font-public-sans"})`,
								}}
							>
								{FONT_CONFIG[settings.font]?.label ?? "Public Sans"}
							</span>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
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
						size="lg"
						className="grid-cols-3"
						value={settings.mode}
						onValueChange={(v) => updateSettings({ mode: v as Mode })}
					>
						{MODES.map(({ value, label }) => (
							<Label
								key={value}
								htmlFor={`mode-${value}`}
								className="relative flex flex-col items-center justify-center gap-1 border not-last:border-r-0 px-2 text-center shadow-xs outline-none transition-[color,box-shadow] first:rounded-l-md last:rounded-r-md has-data-checked:bg-accent"
							>
								<RadioGroupItem
									id={`mode-${value}`}
									value={value}
									className="sr-only absolute inset-0"
									aria-label={label}
								/>
								<p className="text-foreground">{label}</p>
							</Label>
						))}
					</RadioGroup>
				</div>

				<div className="flex flex-col gap-1 px-3">
					<Label htmlFor="radius">圆角</Label>
					<RadioGroup
						id="radius"
						aria-label="圆角"
						variant="segmented"
						size="lg"
						className="grid-cols-4"
						value={settings.radius}
						onValueChange={(v) => updateSettings({ radius: v as Radius })}
					>
						{RADII.map(({ value, label, tooltip }) => (
							<Tooltip key={value}>
								<TooltipTrigger
									render={
										<Label
											htmlFor={`radius-${value}`}
											className="relative flex flex-col items-center justify-center gap-3 border not-last:border-r-0 px-2 text-center shadow-xs outline-none transition-[color,box-shadow] first:rounded-l-md last:rounded-r-md has-data-checked:bg-accent"
										/>
									}
								>
									<RadioGroupItem
										id={`radius-${value}`}
										value={value}
										className="sr-only absolute inset-0"
										aria-label={label}
									/>
									{value === "none" ? (
										<BanIcon aria-hidden="true" />
									) : (
										<p className="text-foreground">{label}</p>
									)}
								</TooltipTrigger>
								<TooltipContent>{tooltip}</TooltipContent>
							</Tooltip>
						))}
					</RadioGroup>
				</div>

				<div className="flex flex-col gap-1 px-3">
					<Label htmlFor="scale">界面缩放</Label>
					<RadioGroup
						id="scale"
						aria-label="界面缩放"
						variant="segmented"
						size="lg"
						className="grid-cols-4"
						value={settings.scale}
						onValueChange={(v) => updateSettings({ scale: v as Scale })}
					>
						{SCALE_MODES.map((item) => (
							<Label
								key={item.value}
								htmlFor={`scale-${item.value}`}
								className="relative flex flex-col items-center justify-center gap-3 border not-last:border-r-0 px-2 text-center shadow-xs outline-none transition-[color,box-shadow] first:rounded-l-md last:rounded-r-md has-data-checked:bg-accent"
							>
								<RadioGroupItem
									id={`scale-${item.value}`}
									value={item.value}
									className="sr-only absolute inset-0"
									aria-label={item.label}
								/>
								<p className="text-foreground">{item.label}</p>
							</Label>
						))}
					</RadioGroup>
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default ThemeCustomizer;
