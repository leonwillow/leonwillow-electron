/**
 * @file 内置和自定义主题的统一选择器。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/theme-customizer.tsx、components/theme-editor/theme-control-panel.tsx。
 * 调用：ui 基础组件/样式、configs/theme-presets、stores/theme-store、types/theme。
 * 功能：分组展示名称与当前模式的主色色点。
 * 预期结果：常用设置和完整编辑器使用相同选项与键盘交互。
 */
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import { themePresets } from "@/configs/theme-presets";
import { useThemeStore } from "@/stores/theme-store";
import type { Settings } from "@/types/theme";

const DEFAULT_PRIMARY = {
	light: "oklch(0.52 0.105 223.128)",
	dark: "oklch(0.45 0.085 224.283)",
};

type Props = {
	id?: string;
	value: Settings["themePreset"];
	mode: "light" | "dark";
	onValueChange: (value: Settings["themePreset"]) => void;
};

export default function ThemePresetSelect({
	id,
	value,
	mode,
	onValueChange,
}: Props) {
	const customThemes = useThemeStore((state) => state.preferences.customThemes);
	const builtIn = Object.entries(themePresets).map(([value, theme]) => ({
		value,
		...theme,
	}));
	const saved = customThemes.map(({ id: value, ...theme }) => ({
		value,
		...theme,
	}));
	const presets = [...builtIn, ...saved];
	const current = presets.find((preset) => preset.value === value);
	return (
		<Select
			id={id}
			aria-label="主题预设"
			items={[
				{ value: "default", label: "默认" },
				...presets.map(({ value, label }) => ({ value, label })),
			]}
			value={value}
			onValueChange={(next) => {
				if (next) onValueChange(next as Settings["themePreset"]);
			}}
		>
			<SelectTrigger size="lg" className="w-full">
				<span
					className="size-2.5 shrink-0 rounded-full"
					style={{
						background: current?.styles[mode].primary ?? DEFAULT_PRIMARY[mode],
					}}
				/>
				<span className="flex-1 truncate text-left">
					{current?.label ?? "默认"}
				</span>
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false}>
				<SelectGroup>
					<SelectLabel>内置主题</SelectLabel>
					<SelectItem value="default" className="[&>div]:items-center">
						<span
							className="size-2 shrink-0 rounded-full"
							style={{ background: DEFAULT_PRIMARY[mode] }}
						/>
						默认
					</SelectItem>
					{builtIn.map((preset) => (
						<SelectItem
							key={preset.value}
							value={preset.value}
							className="[&>div]:items-center"
						>
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ background: preset.styles[mode].primary }}
							/>
							{preset.label}
						</SelectItem>
					))}
				</SelectGroup>
				{saved.length > 0 && (
					<SelectGroup>
						<SelectLabel>我的主题</SelectLabel>
						{saved.map((preset) => (
							<SelectItem
								key={preset.value}
								value={preset.value}
								className="[&>div]:items-center"
							>
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ background: preset.styles[mode].primary }}
								/>
								{preset.label}
							</SelectItem>
						))}
					</SelectGroup>
				)}
			</SelectContent>
		</Select>
	);
}
