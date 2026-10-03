// 从原模板 ThemeCustomizer 提取，保留 Select 的组合、色点和 Base UI 键盘行为。
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import { themePresets } from "@/configs/theme-presets";
import { useSettings } from "@/hooks/use-settings";
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
	const { customThemes } = useSettings();
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
