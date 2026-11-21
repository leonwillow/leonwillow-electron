/**
 * @file 常用主题面板中的全局线条外观设置。
 * 创建时间：2026-11-17；修改时间：2026-11-20。
 * 版本作用：复用分段单选与 ReUI 最近颜色色盘，按明暗模式保存线条颜色。
 * 被调用：ThemeCustomizer；调用：主题 Store、共享 ColorPicker、RadioGroup。
 * 预期结果：粗细与有效颜色即时持久化，跟随主题时保留原语义色及透明度，弹层首帧无高度跳动。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	ColorPicker,
	ColorPickerArea,
	ColorPickerContent,
	ColorPickerEyeDropper,
	ColorPickerFields,
	ColorPickerPanel,
	ColorPickerSlider,
	ColorPickerSwatch,
	ColorPickerSwatches,
	ColorPickerTrigger,
} from "@leonwillow-electron/ui/components/color-picker";
import {
	addRecentColor,
	parseRecentColors,
} from "@leonwillow-electron/ui/components/color-picker-history";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	RadioGroup,
	RadioGroupSegmentedItem,
} from "@leonwillow-electron/ui/components/radio-group";
import { CheckIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useThemeStore } from "@/stores/theme-store";
import type { BorderWidth } from "@/types/theme";

const WIDTHS: readonly BorderWidth[] = [0.5, 1, 1.5, 2];
const RECENT_COLORS_KEY = "leonwillow:theme-line-recent-colors:v1";

function readRecentColors() {
	try {
		return parseRecentColors(localStorage.getItem(RECENT_COLORS_KEY));
	} catch {
		return [];
	}
}

export function ThemeLineSettings({ mode }: { mode: "light" | "dark" }) {
	const settings = useThemeStore((state) => state.preferences.settings);
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const id = useId();
	const [themeBorder, setThemeBorder] = useState<string | null>(
		() =>
			getComputedStyle(document.documentElement)
				.getPropertyValue("--border")
				.trim() || null,
	);
	const [recent, setRecent] = useState(readRecentColors);
	const [pickerOpen, setPickerOpen] = useState(false);
	const colorKey = mode === "dark" ? "borderColorDark" : "borderColorLight";
	const customColor = settings[colorKey];
	const colorLabel = `线条颜色（${mode === "dark" ? "深色" : "浅色"}）`;
	const colorId = `${id}-color`;
	const colorLabelId = `${colorId}-label`;
	const recentLabelId = `${colorId}-recent`;
	const widthLabelId = `${id}-width-label`;
	const restoreDefault = () => {
		updateSettings({ [colorKey]: null });
		setPickerOpen(false);
	};

	const rememberColor = (value: string | null) => {
		const next = addRecentColor(recent, value);
		setRecent(next);
		try {
			localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
		} catch {
			// 存储受限时仍可调色；本次打开期间保留最近颜色。
		}
	};

	useEffect(() => {
		const root = document.documentElement;
		const readBorder = () => {
			const color = getComputedStyle(root).getPropertyValue("--border").trim();
			if (color) setThemeBorder(color);
		};
		readBorder();
		// 读取原主题边框色，不读取全局覆盖变量，恢复跟随时不保留旧覆盖。
		const observer = new MutationObserver(readBorder);
		observer.observe(root, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => observer.disconnect();
	}, []);

	return (
		<div className="flex flex-col gap-3 px-3">
			<div className="flex flex-col gap-1">
				<span id={widthLabelId} className="font-medium text-xs leading-none">
					线条粗细
				</span>
				<RadioGroup
					aria-labelledby={widthLabelId}
					variant="segmented"
					size="default"
					className="grid-cols-4"
					value={String(settings.borderWidth)}
					onValueChange={(value) =>
						updateSettings({ borderWidth: Number(value) as BorderWidth })
					}
				>
					{WIDTHS.map((width) => (
						<RadioGroupSegmentedItem
							key={width}
							id={`${id}-${width}`}
							value={String(width)}
							aria-label={`${width}px`}
						>
							{width}px
						</RadioGroupSegmentedItem>
					))}
				</RadioGroup>
			</div>
			{themeBorder && (
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between gap-2">
						<Label id={colorLabelId} htmlFor={colorId}>
							{colorLabel}
						</Label>
						<Button
							variant="ghost"
							size="xs"
							aria-label={`${colorLabel}恢复默认`}
							disabled={customColor === null}
							onClick={restoreDefault}
						>
							默认
						</Button>
					</div>
					<ColorPicker
						id={colorId}
						open={pickerOpen}
						onOpenChange={setPickerOpen}
						value={customColor ?? themeBorder}
						alpha
						format="hex"
						aria-labelledby={colorLabelId}
						onValueChange={(value) => {
							if (value) updateSettings({ [colorKey]: value });
						}}
						onValueCommit={rememberColor}
					>
						<ColorPickerTrigger className="w-full" />
						<ColorPickerContent>
							<ColorPickerPanel>
								<Button
									variant="ghost"
									className="justify-start aria-pressed:bg-accent"
									aria-label={`${colorLabel}使用主题默认色`}
									aria-pressed={customColor === null}
									onClick={restoreDefault}
								>
									<ColorPickerSwatch color={themeBorder} />
									默认
									{customColor === null && (
										<CheckIcon className="ml-auto" aria-hidden="true" />
									)}
								</Button>
								<ColorPickerArea />
								<div className="flex items-center gap-3">
									<ColorPickerEyeDropper />
									<div className="flex min-w-0 flex-1 flex-col gap-3">
										<ColorPickerSlider channel="hue" />
										<ColorPickerSlider channel="alpha" />
									</div>
								</div>
								<ColorPickerFields />
								{recent.length > 0 && (
									<div className="flex flex-col gap-2">
										<span
											id={recentLabelId}
											className="font-medium text-muted-foreground text-xs"
										>
											最近使用
										</span>
										<ColorPickerSwatches
											colors={recent}
											aria-labelledby={recentLabelId}
										/>
									</div>
								)}
							</ColorPickerPanel>
						</ColorPickerContent>
					</ColorPicker>
				</div>
			)}
		</div>
	);
}
