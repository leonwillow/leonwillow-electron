/**
 * @file 画布背景颜色与纹理设置。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：在本地草稿中预览，应用后更新画布外观；Escape 放弃草稿。
 * 被调用：GraphCanvas；调用：共享 Popover/RadioGroup、现有 ColorSwatch 和背景偏好规则。
 * 预期结果：预设与自定义颜色可组合纹理，支持恢复默认，不加载图片或请求接口。
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
import { PaintBucketIcon } from "lucide-react";
import { type CSSProperties, useContext, useId, useState } from "react";
import { ColorSwatch } from "@/components/theme-editor/theme-color-panel";
import {
	type CanvasBackground,
	canvasInk,
	canvasPatterns,
	canvasTones,
	defaultCanvasBackground,
	opaqueCanvasColor,
} from "@/lib/funds-canvas-background";
import { GraphToolbarContext } from "./graph-toolbar-context";

export function canvasBackgroundProps(background: CanvasBackground) {
	const color = opaqueCanvasColor(background.customColor);
	return {
		"data-canvas-tone": background.tone,
		"data-canvas-pattern": background.pattern,
		"data-canvas-ink": canvasInk(color),
		style: { "--funds-canvas-custom": color } as CSSProperties,
	};
}

export default function GraphBackgroundSettings({
	background,
	onChange,
	error,
}: {
	background: CanvasBackground;
	onChange: (value: CanvasBackground) => void;
	error: string;
}) {
	const id = useId();
	const { side, onPopupChange } = useContext(GraphToolbarContext);
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(background);
	const [valid, setValid] = useState(true);
	const changeOpen = (next: boolean) => {
		if (next) {
			setDraft(background);
			setValid(true);
		}
		setOpen(next);
		onPopupChange("canvas-background", next);
	};
	return (
		<Popover open={open} onOpenChange={changeOpen}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button variant="ghost" size="icon" aria-label="画布背景" />
							}
						/>
					}
				>
					<PaintBucketIcon />
				</TooltipTrigger>
				<TooltipContent side={side}>画布背景</TooltipContent>
			</Tooltip>
			<PopoverContent
				side={side}
				sideOffset={10}
				align="center"
				className="max-h-(--available-height) w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-4"
			>
				<PopoverHeader>
					<PopoverTitle>画布背景</PopoverTitle>
				</PopoverHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) {
							onChange({
								...draft,
								customColor: opaqueCanvasColor(draft.customColor),
							});
							changeOpen(false);
						}
					}}
				>
					<div
						{...canvasBackgroundProps(draft)}
						className="funds-canvas-surface funds-canvas-background-preview flex items-center justify-center rounded-md border"
						role="img"
						aria-label="画布背景预览"
					>
						背景预览
					</div>
					<FieldGroup>
						<FieldSet>
							<FieldLegend variant="label">颜色</FieldLegend>
							<RadioGroup
								value={draft.tone}
								aria-label="画布背景颜色"
								className="grid-cols-2 gap-2"
								onValueChange={(tone) => {
									setDraft({
										...draft,
										tone: tone as CanvasBackground["tone"],
									});
									setValid(true);
								}}
							>
								{canvasTones.map(([tone, label]) => (
									<Label
										key={tone}
										htmlFor={`${id}-${tone}`}
										className="cursor-pointer rounded-md border p-2 has-[[data-checked]]:border-primary"
									>
										<RadioGroupItem id={`${id}-${tone}`} value={tone} />
										<span
											{...canvasBackgroundProps({
												...draft,
												tone,
												pattern: "none",
											})}
											className="funds-canvas-surface size-control-md shrink-0 rounded border"
											aria-hidden="true"
										/>
										{label}
									</Label>
								))}
							</RadioGroup>
						</FieldSet>
						{draft.tone === "custom" && (
							<ColorSwatch
								label="自定义背景色"
								value={draft.customColor}
								onChange={(color) => setDraft({ ...draft, customColor: color })}
								onValidityChange={setValid}
							/>
						)}
						<FieldSet>
							<FieldLegend variant="label">纹理</FieldLegend>
							<RadioGroup
								value={draft.pattern}
								variant="segmented"
								aria-label="画布背景纹理"
								className="grid-cols-4"
								onValueChange={(pattern) =>
									setDraft({
										...draft,
										pattern: pattern as CanvasBackground["pattern"],
									})
								}
							>
								{canvasPatterns.map(([pattern, label]) => (
									<Label
										key={pattern}
										htmlFor={`${id}-${pattern}`}
										className="relative flex cursor-pointer items-center justify-center border not-last:border-r-0 px-2 first:rounded-l-md last:rounded-r-md has-data-checked:bg-accent"
									>
										<RadioGroupItem
											id={`${id}-${pattern}`}
											value={pattern}
											className="sr-only absolute inset-0"
										/>
										{label}
									</Label>
								))}
							</RadioGroup>
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
							onClick={() => {
								setDraft({ ...defaultCanvasBackground });
								setValid(true);
							}}
						>
							恢复默认
						</Button>
						<Button type="submit" disabled={!valid}>
							应用背景
						</Button>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
}
