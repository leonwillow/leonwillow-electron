/**
 * @file 资金分析筛选条件的单选字段。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：复用原模板 FilterSelect 的标签与 Base UI Select 组合。
 * 被调用：GraphToolbar、AccountDirectoryFilters；调用：共享 Label、Select。
 * 预期结果：目录与画布筛选使用相同的可访问单选交互和主题。
 */
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { useId } from "react";

export default function FilterSelect({
	label,
	value,
	options,
	onChange,
	disabled = false,
}: {
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Select
				items={options}
				value={value}
				disabled={disabled}
				onValueChange={(v) => v !== null && onChange(v)}
			>
				<SelectTrigger id={id} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{options.map((o) => (
							<SelectItem key={o.value} value={o.value}>
								{o.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
