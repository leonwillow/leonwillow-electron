/**
 * @file 统一的关键词搜索输入框组件。
 * 创建时间：2026-11-19；修改时间：2026-11-19。
 * 版本作用：统一全应用搜索框的图标位置、高度、清空按钮与显式表单提交交互。
 * 被调用：WorkspaceMenuSearch、DataGrid、管理页及各业务检索栏。
 * 调用：ui InputGroup/Tooltip、ui/lib/utils、lucide-react、react。
 * 功能：左侧固定显示搜索图标，输入非空时右侧显示清空按钮；传入 onSubmit 时以原生表单支持 IME 安全的回车提交。
 * 预期结果：全应用搜索框图标位置、控件高度与清空体验一致，不出现原生重复清除图标。
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
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { CornerDownLeftIcon, SearchIcon, XIcon } from "lucide-react";
import { type ComponentProps, useRef } from "react";

type SearchInputProps = Omit<
	ComponentProps<typeof InputGroupInput>,
	"value" | "onChange" | "size" | "type" | "onSubmit"
> & {
	value: string;
	onValueChange: (value: string) => void;
	onClear?: () => void;
	onSubmit?: () => void;
	clearLabel?: string;
	submitLabel?: string;
	formLabel?: string;
	size?: "sm" | "default" | "lg";
	inputClassName?: string;
};

function SearchInput({
	value,
	onValueChange,
	onClear,
	onSubmit,
	clearLabel,
	submitLabel,
	formLabel,
	size = "default",
	className,
	inputClassName,
	"aria-label": ariaLabel,
	...props
}: SearchInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const resolvedClearLabel =
		clearLabel ?? (ariaLabel ? `清空${ariaLabel}` : "清空搜索");
	const resolvedSubmitLabel =
		submitLabel ?? (ariaLabel ? `执行${ariaLabel}` : "执行搜索");

	const group = (
		<InputGroup
			data-slot={onSubmit ? undefined : "search-input"}
			size={size}
			className={onSubmit ? undefined : className}
		>
			<InputGroupAddon align="inline-start">
				<SearchIcon aria-hidden="true" />
			</InputGroupAddon>
			<InputGroupInput
				ref={inputRef}
				type="text"
				enterKeyHint="search"
				aria-label={ariaLabel}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				className={inputClassName}
				{...props}
			/>
			{value && (
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						type="button"
						size="icon-xs"
						aria-label={resolvedClearLabel}
						onClick={() => {
							onValueChange("");
							onClear?.();
							inputRef.current?.focus();
						}}
					>
						<XIcon />
					</InputGroupButton>
					{onSubmit && (
						<Tooltip>
							<TooltipTrigger
								render={
									<InputGroupButton
										type="submit"
										size="icon-xs"
										aria-label={resolvedSubmitLabel}
									>
										<CornerDownLeftIcon />
									</InputGroupButton>
								}
							/>
							<TooltipContent>{resolvedSubmitLabel}</TooltipContent>
						</Tooltip>
					)}
				</InputGroupAddon>
			)}
		</InputGroup>
	);

	if (onSubmit) {
		return (
			<search data-slot="search-input" className={cn("min-w-0", className)}>
				<form
					aria-label={formLabel ?? ariaLabel ?? "搜索"}
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					{group}
					{!value && (
						<button type="submit" className="sr-only" tabIndex={-1}>
							{resolvedSubmitLabel}
						</button>
					)}
				</form>
			</search>
		);
	}

	return group;
}

export { SearchInput, type SearchInputProps };
