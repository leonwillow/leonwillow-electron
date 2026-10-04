/**
 * @file 按语义分组的主题颜色编辑区域。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/theme-editor/shadow-control.tsx、components/theme-editor/theme-control-panel.tsx。
 * 调用：ui 基础组件/样式、react、lib/custom-themes、types/theme、utils/theme/color-converter。
 * 功能：组合颜色字段、原生色盘及文本校验；延迟提交色盘拖动。
 * 预期结果：有效颜色进入草稿，无效输入保留在字段并报告给保存按钮。
 */
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@leonwillow-electron/ui/components/accordion";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import type { InputHTMLAttributes } from "react";
import { useEffect, useEffectEvent, useId, useState } from "react";
import { isColorValue } from "@/lib/custom-themes";
import type { ThemeStyleProps } from "@/types/theme";

import { colorFormatter } from "@/utils/theme/color-converter";

type ColorSwatchProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	onValidityChange?: (valid: boolean) => void;
};

type DebouncedInputProps = {
	value: string;
	onChange: (value: string) => void;
	debounce?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">;

/**
 * 原生调色盘拖动时延迟提交颜色，失焦时补交最后一次输入。
 * @param props value 为六位 HEX；debounce 以毫秒计，onChange 接收最后色值。
 * @returns 受控调色输入；effect 清理取消尚未执行的提交。
 */
const DebouncedInput = ({
	value: initialValue,
	onChange,
	debounce = 300,
	...props
}: DebouncedInputProps) => {
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	const emitChange = useEffectEvent(onChange);
	useEffect(() => {
		if (value === initialValue) return;
		const timeout = setTimeout(() => {
			emitChange(value);
		}, debounce);

		return () => clearTimeout(timeout);
	}, [value, initialValue, debounce]);

	return (
		<input
			{...props}
			type="color"
			onBlur={() => {
				if (value !== initialValue) emitChange(value);
			}}
			value={value}
			onChange={(e) => setValue(e.target.value)}
		/>
	);
};

/**
 * 让原生色盘和文本色值共用一个字段，同时保留尚未输入完整的文本。
 * @param props onChange 只接收有效颜色，onValidityChange 单独报告文本是否可保存。
 * @returns 带标签、色盘与错误提示的颜色字段。
 */
export const ColorSwatch = ({
	label,
	value,
	onChange,
	onValidityChange,
}: ColorSwatchProps) => {
	const [localValue, setLocalValue] = useState(value);
	const id = useId();
	const valid = isColorValue(localValue);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const hexColor = valid ? colorFormatter(localValue, "hex") : "";

	return (
		<Field data-invalid={!valid} className="gap-1.5">
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<span className="font-mono text-muted-foreground text-xs">
					{hexColor}
				</span>
			</div>
			<div className="flex items-center gap-2">
				<div
					className="relative flex size-control-lg cursor-pointer items-center justify-center overflow-hidden rounded border"
					style={{ backgroundColor: valid ? localValue : value }}
				>
					<DebouncedInput
						aria-label={`${label}调色盘`}
						value={(hexColor || colorFormatter(value, "hex")).slice(0, 7)}
						onChange={(localValue) => {
							setLocalValue(localValue);
							onChange(localValue);
							onValidityChange?.(true);
						}}
						className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
					/>
				</div>
				<Input
					id={id}
					size="lg"
					type="text"
					aria-invalid={!valid}
					value={localValue}
					onChange={(e) => {
						setLocalValue(e.target.value);
						const valid = isColorValue(e.target.value);
						onValidityChange?.(valid);
						if (valid) onChange(e.target.value);
					}}
					className="flex-1 font-mono"
				/>
			</div>
			{!valid && (
				<FieldError>请输入有效的 HEX、OKLCH、HSL 或 RGB 颜色。</FieldError>
			)}
		</Field>
	);
};

type ThemeColorPanelProps = {
	currentTheme: Partial<ThemeStyleProps>;
	updateColor: (key: keyof ThemeStyleProps, value: string) => void;
	onValidityChange: (key: string, valid: boolean) => void;
};
const ThemeColorPanel = ({
	currentTheme,
	updateColor,
	onValidityChange,
}: ThemeColorPanelProps) => {
	return (
		<div className="flex flex-col gap-6">
			<Accordion multiple defaultValue={["brand"]} className="w-full gap-4">
				<AccordionItem value="brand" className="rounded-lg border px-4">
					<AccordionTrigger className="cursor-pointer py-3 font-medium text-base">
						品牌颜色
					</AccordionTrigger>
					<AccordionContent
						keepMounted
						className="flex flex-col gap-3 pt-2 pb-4"
					>
						<ColorSwatch
							label="主色"
							value={currentTheme?.primary || ""}
							onChange={(value) => updateColor("primary", value)}
							onValidityChange={(valid) => onValidityChange("primary", valid)}
						/>
						<ColorSwatch
							label="主色前景"
							value={currentTheme?.["primary-foreground"] || ""}
							onChange={(value) => updateColor("primary-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("primary-foreground", valid)
							}
						/>
						<ColorSwatch
							label="次色"
							value={currentTheme?.secondary || ""}
							onChange={(value) => updateColor("secondary", value)}
							onValidityChange={(valid) => onValidityChange("secondary", valid)}
						/>
						<ColorSwatch
							label="次色前景"
							value={currentTheme?.["secondary-foreground"] || ""}
							onChange={(value) => updateColor("secondary-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("secondary-foreground", valid)
							}
						/>
						<ColorSwatch
							label="危险操作"
							value={currentTheme?.destructive || ""}
							onChange={(value) => updateColor("destructive", value)}
							onValidityChange={(valid) =>
								onValidityChange("destructive", valid)
							}
						/>
						<ColorSwatch
							label="危险操作前景"
							value={currentTheme?.["destructive-foreground"] || ""}
							onChange={(value) => updateColor("destructive-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("destructive-foreground", valid)
							}
						/>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="base" className="rounded-lg border px-4">
					<AccordionTrigger className="cursor-pointer py-3 font-medium text-base">
						基础界面
					</AccordionTrigger>
					<AccordionContent
						keepMounted
						className="flex flex-col gap-3 pt-2 pb-4"
					>
						<ColorSwatch
							label="页面背景"
							value={currentTheme?.background || ""}
							onChange={(value) => updateColor("background", value)}
							onValidityChange={(valid) =>
								onValidityChange("background", valid)
							}
						/>
						<ColorSwatch
							label="正文"
							value={currentTheme?.foreground || ""}
							onChange={(value) => updateColor("foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("foreground", valid)
							}
						/>
						<ColorSwatch
							label="卡片背景"
							value={currentTheme?.card || ""}
							onChange={(value) => updateColor("card", value)}
							onValidityChange={(valid) => onValidityChange("card", valid)}
						/>
						<ColorSwatch
							label="卡片前景"
							value={currentTheme?.["card-foreground"] || ""}
							onChange={(value) => updateColor("card-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("card-foreground", valid)
							}
						/>
						<ColorSwatch
							label="浮层背景"
							value={currentTheme?.popover || ""}
							onChange={(value) => updateColor("popover", value)}
							onValidityChange={(valid) => onValidityChange("popover", valid)}
						/>
						<ColorSwatch
							label="浮层前景"
							value={currentTheme?.["popover-foreground"] || ""}
							onChange={(value) => updateColor("popover-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("popover-foreground", valid)
							}
						/>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="other" className="rounded-lg border px-4">
					<AccordionTrigger className="cursor-pointer py-3 font-medium text-base">
						交互颜色
					</AccordionTrigger>
					<AccordionContent
						keepMounted
						className="flex flex-col gap-3 pt-2 pb-4"
					>
						<ColorSwatch
							label="弱化背景"
							value={currentTheme?.muted || ""}
							onChange={(value) => updateColor("muted", value)}
							onValidityChange={(valid) => onValidityChange("muted", valid)}
						/>
						<ColorSwatch
							label="辅助文字"
							value={currentTheme?.["muted-foreground"] || ""}
							onChange={(value) => updateColor("muted-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("muted-foreground", valid)
							}
						/>
						<ColorSwatch
							label="强调背景"
							value={currentTheme?.accent || ""}
							onChange={(value) => updateColor("accent", value)}
							onValidityChange={(valid) => onValidityChange("accent", valid)}
						/>
						<ColorSwatch
							label="强调前景"
							value={currentTheme?.["accent-foreground"] || ""}
							onChange={(value) => updateColor("accent-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("accent-foreground", valid)
							}
						/>
						<ColorSwatch
							label="边框"
							value={currentTheme?.border || ""}
							onChange={(value) => updateColor("border", value)}
							onValidityChange={(valid) => onValidityChange("border", valid)}
						/>
						<ColorSwatch
							label="输入框边框"
							value={currentTheme?.input || ""}
							onChange={(value) => updateColor("input", value)}
							onValidityChange={(valid) => onValidityChange("input", valid)}
						/>
						<ColorSwatch
							label="焦点轮廓"
							value={currentTheme?.ring || ""}
							onChange={(value) => updateColor("ring", value)}
							onValidityChange={(valid) => onValidityChange("ring", valid)}
						/>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="sidebar" className="rounded-lg border px-4">
					<AccordionTrigger className="cursor-pointer py-3 font-medium text-base">
						侧栏颜色
					</AccordionTrigger>
					<AccordionContent
						keepMounted
						className="flex flex-col gap-3 pt-2 pb-4"
					>
						<ColorSwatch
							label="侧栏背景"
							value={currentTheme?.sidebar || ""}
							onChange={(value) => updateColor("sidebar", value)}
							onValidityChange={(valid) => onValidityChange("sidebar", valid)}
						/>
						<ColorSwatch
							label="侧栏文字"
							value={currentTheme?.["sidebar-foreground"] || ""}
							onChange={(value) => updateColor("sidebar-foreground", value)}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-foreground", valid)
							}
						/>
						<ColorSwatch
							label="侧栏主色"
							value={currentTheme?.["sidebar-primary"] || ""}
							onChange={(value) => updateColor("sidebar-primary", value)}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-primary", valid)
							}
						/>
						<ColorSwatch
							label="侧栏主色前景"
							value={currentTheme?.["sidebar-primary-foreground"] || ""}
							onChange={(value) =>
								updateColor("sidebar-primary-foreground", value)
							}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-primary-foreground", valid)
							}
						/>
						<ColorSwatch
							label="侧栏强调"
							value={currentTheme?.["sidebar-accent"] || ""}
							onChange={(value) => updateColor("sidebar-accent", value)}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-accent", valid)
							}
						/>
						<ColorSwatch
							label="侧栏强调前景"
							value={currentTheme?.["sidebar-accent-foreground"] || ""}
							onChange={(value) =>
								updateColor("sidebar-accent-foreground", value)
							}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-accent-foreground", valid)
							}
						/>
						<ColorSwatch
							label="侧栏边框"
							value={currentTheme?.["sidebar-border"] || ""}
							onChange={(value) => updateColor("sidebar-border", value)}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-border", valid)
							}
						/>
						<ColorSwatch
							label="侧栏焦点轮廓"
							value={currentTheme?.["sidebar-ring"] || ""}
							onChange={(value) => updateColor("sidebar-ring", value)}
							onValidityChange={(valid) =>
								onValidityChange("sidebar-ring", valid)
							}
						/>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="chart" className="rounded-lg border px-4">
					<AccordionTrigger className="cursor-pointer py-3 font-medium text-base">
						图表颜色
					</AccordionTrigger>
					<AccordionContent
						keepMounted
						className="flex flex-col gap-3 pt-2 pb-4"
					>
						<ColorSwatch
							label="图表颜色 1"
							value={currentTheme?.["chart-1"] || ""}
							onChange={(value) => updateColor("chart-1", value)}
							onValidityChange={(valid) => onValidityChange("chart-1", valid)}
						/>
						<ColorSwatch
							label="图表颜色 2"
							value={currentTheme?.["chart-2"] || ""}
							onChange={(value) => updateColor("chart-2", value)}
							onValidityChange={(valid) => onValidityChange("chart-2", valid)}
						/>
						<ColorSwatch
							label="图表颜色 3"
							value={currentTheme?.["chart-3"] || ""}
							onChange={(value) => updateColor("chart-3", value)}
							onValidityChange={(valid) => onValidityChange("chart-3", valid)}
						/>
						<ColorSwatch
							label="图表颜色 4"
							value={currentTheme?.["chart-4"] || ""}
							onChange={(value) => updateColor("chart-4", value)}
							onValidityChange={(valid) => onValidityChange("chart-4", valid)}
						/>
						<ColorSwatch
							label="图表颜色 5"
							value={currentTheme?.["chart-5"] || ""}
							onChange={(value) => updateColor("chart-5", value)}
							onValidityChange={(valid) => onValidityChange("chart-5", valid)}
						/>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
};

export default ThemeColorPanel;
