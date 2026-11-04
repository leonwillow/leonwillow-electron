/**
 * @file 模板字段对应的中文表单控件。
 * 创建时间：2026-10-10；修改时间：2026-10-10。
 * 版本作用：同一字段定义用于新建和历史文书编辑。
 * 被调用：document-editor、template-dialog；调用：共享 Field/Input/Textarea。
 * 功能与预期结果：显示必填与原生日期/时间输入，控件沿用共享排版和缩放。
 */
import { Field, FieldLabel } from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import type { DocumentField } from "@/lib/documents";
export default function FieldInput({
	field,
	value,
	onChange,
	disabled,
	required = field.required,
	idPrefix = "document",
}: {
	field: DocumentField;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	required?: boolean;
	idPrefix?: string;
}) {
	const id = `${idPrefix}-${field.key}`;
	const props = {
		id,
		value,
		disabled,
		required,
		maxLength: 4000,
		onChange: (
			event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
		) => onChange(event.target.value),
	};
	return (
		<Field data-disabled={disabled}>
			<FieldLabel htmlFor={id}>
				{field.label}
				{required ? " *" : ""}
			</FieldLabel>
			{field.kind === "textarea" ? (
				<Textarea {...props} rows={3} />
			) : (
				<Input
					{...props}
					type={
						field.kind === "date" || field.kind === "time" ? field.kind : "text"
					}
				/>
			)}
		</Field>
	);
}
