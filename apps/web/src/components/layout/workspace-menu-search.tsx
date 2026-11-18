/**
 * @file 工作台二级菜单共用的关键词检索输入框。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：统一计算器、资金案件与笔录目录三处二级菜单的搜索栏结构，并统一提供一键清空能力。
 * 被调用：use-calculator-menu、use-funds-case-menu、use-inquiry-case-menu。
 * 调用：ui InputGroup/Tooltip、lucide-react。
 * 功能：支持即时输入检索或表单显式提交检索，有输入内容时显示清空按钮。
 * 预期结果：保持无障碍标签完整，交互与间距统一。
 */
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { SearchIcon, XIcon } from "lucide-react";

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
	const input = (
		<InputGroup>
			<InputGroupInput
				aria-label={label}
				placeholder={placeholder}
				maxLength={maxLength}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			<InputGroupAddon align="inline-end">
				{value && (
					<InputGroupButton
						type="button"
						size="icon-xs"
						aria-label={`清空${label}`}
						onClick={() => {
							onChange("");
							onClear?.();
						}}
					>
						<XIcon />
					</InputGroupButton>
				)}
				{onSubmit ? (
					<Tooltip>
						<TooltipTrigger
							render={
								<InputGroupButton
									type="submit"
									size="icon-sm"
									aria-label={submitLabel ?? `执行${label}`}
								>
									<SearchIcon />
								</InputGroupButton>
							}
						/>
						<TooltipContent>{submitLabel ?? label}</TooltipContent>
					</Tooltip>
				) : (
					!value && <SearchIcon />
				)}
			</InputGroupAddon>
		</InputGroup>
	);

	if (onSubmit) {
		return (
			<search>
				<form
					aria-label={formLabel ?? label}
					className="p-workspace-gutter pb-2"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					{input}
				</form>
			</search>
		);
	}

	return <div className="p-workspace-gutter">{input}</div>;
}
