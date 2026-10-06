/**
 * @file 账户目录的高级筛选弹窗。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：搜索栏旁按需展开条件，应用后只筛选目录。
 * 被调用：AccountDirectory；调用：共享 Popover、FilterSelect、目录校验。
 * 预期结果：保留草稿、组合查询、校验笔数区间，支持一键重置。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { ListFilterIcon } from "lucide-react";
import { useId, useState } from "react";
import {
	type DirectoryFilters,
	directoryFilterCount,
	directoryFilterError,
	emptyDirectoryFilters,
} from "@/lib/funds-directory";
import FilterSelect from "./filter-select";

const fields = [
	{
		key: "coverage",
		label: "流水状态",
		options: [
			{ value: "all", label: "全部" },
			{ value: "statement", label: "已有本方流水" },
			{ value: "counterparty", label: "仅见交易对手" },
		],
	},
	{
		key: "naming",
		label: "户名状态",
		options: [
			{ value: "all", label: "全部" },
			{ value: "conflict", label: "户名冲突" },
			{ value: "consistent", label: "无户名冲突" },
		],
	},
	{
		key: "mark",
		label: "特殊标记",
		options: [
			{ value: "all", label: "全部" },
			{ value: "marked", label: "已标记" },
			{ value: "unmarked", label: "未标记" },
		],
	},
	{
		key: "visibility",
		label: "手动隐藏",
		options: [
			{ value: "all", label: "全部" },
			{ value: "hidden", label: "已隐藏" },
			{ value: "visible", label: "未隐藏" },
		],
	},
] as const;

export default function AccountDirectoryFilters({
	value,
	onChange,
}: {
	value: DirectoryFilters;
	onChange: (next: DirectoryFilters) => void;
}) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(value);
	const id = useId();
	const count = directoryFilterCount(value);
	const error = directoryFilterError(draft);
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				if (next) setDraft(value);
				setOpen(next);
			}}
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button
									type="button"
									variant={count ? "secondary" : "outline"}
									size="icon"
									aria-label={
										count ? `筛选账户（${count} 项已应用）` : "筛选账户"
									}
									className={count ? "shrink-0 text-primary" : "shrink-0"}
								>
									<ListFilterIcon />
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>
					{count ? `筛选账户 · ${count} 项已应用` : "筛选账户"}
				</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="start"
				sideOffset={8}
				className="max-h-(--available-height) w-80 max-w-(--available-width) overflow-y-auto p-4"
			>
				<PopoverHeader>
					<PopoverTitle>筛选账户</PopoverTitle>
					<PopoverDescription>筛选当前目录中的账户或主体。</PopoverDescription>
				</PopoverHeader>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (error) return;
						onChange(draft);
						setOpen(false);
					}}
				>
					<div className="grid grid-cols-2 gap-3">
						{fields.map((field) => (
							<FilterSelect
								key={field.key}
								label={field.label}
								value={draft[field.key]}
								options={[...field.options]}
								onChange={(next) => setDraft({ ...draft, [field.key]: next })}
							/>
						))}
						{[
							{ key: "minCount", label: "最低交易笔数" },
							{ key: "maxCount", label: "最高交易笔数" },
						].map(({ key, label }) => (
							<div className="space-y-1.5" key={key}>
								<Label htmlFor={`${id}-${key}`}>{label}</Label>
								<Input
									id={`${id}-${key}`}
									inputMode="numeric"
									placeholder="不限"
									value={draft[key as "minCount" | "maxCount"]}
									aria-invalid={!!error}
									aria-describedby={error ? `${id}-error` : undefined}
									onChange={(event) =>
										setDraft({ ...draft, [key]: event.target.value })
									}
								/>
							</div>
						))}
					</div>
					{error && (
						<p id={`${id}-error`} role="alert" className="text-destructive">
							{error}
						</p>
					)}
					<div className="flex justify-between gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setDraft(emptyDirectoryFilters);
								onChange(emptyDirectoryFilters);
								setOpen(false);
							}}
						>
							重置筛选
						</Button>
						<Button type="submit" disabled={!!error}>
							应用筛选
						</Button>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
}
