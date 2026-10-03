// 迁移自 shadcnstudio/shadcn-studio，来源与适配见 docs/custom-theme-migration.md。
// React Imports

// Component Imports
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

const SliderWithInput = ({
	value,
	onChange,
	min,
	max,
	step = 1,
	label,
	unit = "px",
}: SliderWithInputProps) => {
	// States
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
