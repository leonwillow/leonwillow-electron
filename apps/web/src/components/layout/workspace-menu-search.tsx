/**
 * @file 工作台二级菜单共用的关键词检索输入框。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-19
 * 版本作用：统一案件、文书类型、笔录与计算器二级菜单的搜索栏组件、图标位置与间距。
 * 被调用：use-funds-case-menu、use-document-type-menu、use-inquiry-case-menu、use-calculator-menu。
 * 调用：ui SearchInput。
 * 功能：复用共享 SearchInput，保持左侧搜索图标、右侧一键清空与外边距完全一致。
 * 预期结果：所有二级菜单搜索框外观、图标位置、内边距与交互统一。
 */
import { SearchInput } from "@leonwillow-electron/ui/components/search-input";

export function WorkspaceMenuSearch({
	label,
	formLabel,
	placeholder,
	value,
	maxLength,
	submitLabel,
	onChange,
	onSubmit,
	onClear,
}: {
	label: string;
	formLabel?: string;
	placeholder: string;
	value: string;
	maxLength?: number;
	submitLabel?: string;
	onChange: (value: string) => void;
	onSubmit?: () => void;
	onClear?: () => void;
}) {
	return (
		<div className="p-workspace-gutter pb-2">
			<SearchInput
				aria-label={label}
				formLabel={formLabel}
				placeholder={placeholder}
				value={value}
				maxLength={maxLength}
				submitLabel={submitLabel}
				onValueChange={onChange}
				onSubmit={onSubmit}
				onClear={onClear}
			/>
		</div>
	);
}
