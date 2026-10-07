/**
 * @file 图谱工具栏的位置、方向和折叠控件。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：沿用共享 Popover、RadioGroup 和按钮，配置只改变工具栏。
 * 被调用：GraphCanvas；调用：GraphToolbarContext、位置约束与用户偏好保存。
 * 功能：八处停靠、角落横竖切换、受限方向说明、应用及重置。
 * 预期结果：折叠时为纯图标，展开后恢复按钮反馈；编辑布局不跳位。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	FieldGroup,
	FieldLegend,
	FieldSet,
} from "@leonwillow-electron/ui/components/field";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	RadioGroup,
	RadioGroupItem,
} from "@leonwillow-electron/ui/components/radio-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import {
	ChevronsDownIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	ChevronsUpIcon,
	Maximize2Icon,
	Minimize2Icon,
	PinIcon,
	Settings2Icon,
} from "lucide-react";
import { useContext, useId, useState } from "react";
import {
	defaultToolbarLayout,
	type ToolbarLayout,
	type ToolbarOrientation,
	toolbarOrientation,
	toolbarPlacement,
} from "@/lib/funds-toolbar-layout";
import GraphDockPositionField from "./graph-dock-position-field";
import { GraphToolbarContext } from "./graph-toolbar-context";
import type { ToolbarDockState } from "./graph-toolbar-dock";

export function ToolbarFoldButton({
	layout,
	dockState,
	disabled,
	onChange,
}: {
	layout: ToolbarLayout;
	dockState: ToolbarDockState;
	disabled: boolean;
	onChange: (layout: ToolbarLayout) => void;
}) {
	const { side } = useContext(GraphToolbarContext);
	const fold = toolbarPlacement(layout).fold;
	const iconOnly = !dockState.expanded || dockState.moving;
	const label = !dockState.expanded
		? "展开工具栏"
		: layout.collapsed
			? "保持工具栏展开"
			: "折叠工具栏";
	const Icon =
		iconOnly && layout.collapsed
			? Maximize2Icon
			: layout.collapsed
				? PinIcon
				: fold === "up"
					? ChevronsUpIcon
					: fold === "down"
						? ChevronsDownIcon
						: fold === "left"
							? ChevronsLeftIcon
							: fold === "right"
								? ChevronsRightIcon
								: Minimize2Icon;
	return (
		<Tooltip disabled={disabled || iconOnly}>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="funds-graph-toolbar-toggle-button aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50"
						data-icon-only={iconOnly || undefined}
						disabled={disabled}
						aria-label={label}
						aria-expanded={dockState.expanded}
						onClick={() =>
							onChange({ ...layout, collapsed: !layout.collapsed })
						}
					/>
				}
			>
				<Icon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent side={side}>{label}</TooltipContent>
		</Tooltip>
	);
}

export default function GraphToolbarSettings({
	layout,
	onChange,
	error,
}: {
	layout: ToolbarLayout;
	onChange: (layout: ToolbarLayout) => void;
	error: string;
}) {
	const id = useId();
	const { side, onPopupChange } = useContext(GraphToolbarContext);
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(layout);
	const locked =
		draft.position.startsWith("middle") || draft.position.endsWith("center");
	const changeOpen = (value: boolean) => {
		if (value) setDraft(layout);
		setOpen(value);
		onPopupChange("settings", value);
	};
	return (
		<Popover open={open} onOpenChange={changeOpen}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button variant="ghost" size="icon" aria-label="工具栏设置" />
							}
						/>
					}
				>
					<Settings2Icon />
				</TooltipTrigger>
				<TooltipContent side={side}>工具栏设置</TooltipContent>
			</Tooltip>
			<PopoverContent
				side={side}
				sideOffset={10}
				align="center"
				className="max-h-(--available-height) w-64 max-w-[calc(100vw-2rem)] overflow-y-auto p-4"
			>
				<PopoverHeader>
					<PopoverTitle>工具栏布局</PopoverTitle>
				</PopoverHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						onChange({ ...draft, collapsed: layout.collapsed });
						changeOpen(false);
					}}
				>
					<FieldGroup>
						<GraphDockPositionField
							label="工具栏排列位置"
							value={draft.position}
							onChange={(position) => setDraft({ ...draft, position })}
						/>
						<FieldSet>
							<FieldLegend variant="label">排列方向</FieldLegend>
							<RadioGroup
								aria-label="工具栏排列方向"
								value={toolbarOrientation(draft)}
								disabled={locked}
								onValueChange={(orientation) =>
									setDraft({
										...draft,
										orientation: orientation as ToolbarOrientation,
									})
								}
								className="grid-cols-2"
							>
								{(
									[
										["horizontal", "横向"],
										["vertical", "竖向"],
									] as const
								).map(([value, label]) => (
									<Label key={value} htmlFor={`${id}-${value}`}>
										<RadioGroupItem id={`${id}-${value}`} value={value} />
										{label}
									</Label>
								))}
							</RadioGroup>
							{locked && (
								<p className="text-muted-foreground text-xs">
									{draft.position.startsWith("middle")
										? "左中、右中仅支持竖向排列。"
										: "上中、下中仅支持横向排列。"}
								</p>
							)}
						</FieldSet>
					</FieldGroup>
					{error && (
						<p role="alert" className="text-destructive text-xs">
							{error}
						</p>
					)}
					<div className="flex justify-between gap-2">
						<Button
							variant="ghost"
							type="button"
							onClick={() => setDraft(defaultToolbarLayout)}
						>
							恢复默认
						</Button>
						<Button type="submit">应用布局</Button>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
}
