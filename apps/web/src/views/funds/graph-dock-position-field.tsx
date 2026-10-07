/**
 * @file 画布浮动工具的八处停靠选择。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：工具栏与速览复用同一位置网格、中文名称和键盘单选交互。
 * 被调用：GraphToolbarSettings、GraphPreviewSettings；调用：共享 Field/RadioGroup。
 * 预期结果：选择只更新草稿，由上层统一应用。
 */
import {
	FieldLegend,
	FieldSet,
} from "@leonwillow-electron/ui/components/field";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@leonwillow-electron/ui/components/radio-group";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useId } from "react";
import {
	type ToolbarPosition,
	toolbarPositions,
} from "@/lib/funds-toolbar-layout";

export default function GraphDockPositionField({
	value,
	onChange,
	label,
}: {
	value: ToolbarPosition;
	onChange: (position: ToolbarPosition) => void;
	label: string;
}) {
	const id = useId();
	return (
		<FieldSet>
			<FieldLegend variant="label">排列位置</FieldLegend>
			<RadioGroup
				aria-label={label}
				value={value}
				onValueChange={(position) => onChange(position as ToolbarPosition)}
				className="grid-cols-3 gap-2"
			>
				{toolbarPositions.map(([position, name], index) => (
					<Label
						key={position}
						htmlFor={`${id}-${position}`}
						className={cn(
							"cursor-pointer rounded-md border p-2 has-[[data-checked]]:bg-muted",
							index === 4 && "col-start-3",
						)}
					>
						<RadioGroupItem id={`${id}-${position}`} value={position} />
						{name}
					</Label>
				))}
			</RadioGroup>
		</FieldSet>
	);
}
