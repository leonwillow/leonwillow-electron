/**
 * @file 共享数值的滑块与输入框组合。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/theme-editor/shadow-control.tsx、components/theme-editor/theme-control-panel.tsx。
 * 调用：ui 基础组件/样式、react。
 * 功能：保留输入过程中的临时文本，限制提交值范围。
 * 预期结果：滑块与数值输入相互同步，失焦后显示有效值。
 */
import { Field, FieldLabel } from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Slider } from "@leonwillow-electron/ui/components/slider";
import { useEffect, useId, useState } from "react";

type SliderWithInputProps = {
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
	step?: number;
	label: string;
	unit?: string;
};

/**
 * 组合数值输入和滑块，输入过程允许暂时为空，失焦恢复最后有效值。
 * @param props min/max 限制提交范围，step 为步长，unit 仅用于展示。
 * @returns 同步的两种输入方式；onChange 接收限幅后的数字。
 */
const SliderWithInput = ({
	value,
	onChange,
	min,
	max,
	step = 1,
	label,
	unit = "px",
}: SliderWithInputProps) => {
	const [localValue, setLocalValue] = useState<string | number>(value);
	const id = useId();

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	return (
		<Field className="gap-2">
			<div className="flex items-center justify-between gap-2">
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<div className="flex items-center gap-1">
					<Input
						id={id}
						type="number"
						value={localValue}
						onChange={(e) => {
							setLocalValue(e.target.value);
							const number = Number(e.target.value);
							if (e.target.value !== "" && Number.isFinite(number))
								onChange(Math.min(max, Math.max(min, number)));
						}}
						min={min}
						max={max}
						step={step}
						className="w-20"
						size="lg"
						onBlur={() => setLocalValue(value)}
					/>
					<span className="text-muted-foreground text-xs">{unit}</span>
				</div>
			</div>
			<Slider
				aria-label={label}
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={(values) => {
					const next = Array.isArray(values) ? values[0] : values;
					setLocalValue(next);
					onChange(next);
				}}
				className="py-1"
			/>
		</Field>
	);
};

export default SliderWithInput;
