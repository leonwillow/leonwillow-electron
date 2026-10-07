/**
 * @file 悬停速览窗口的位置设置。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：复用工具栏的位置选择，窗口独立保存，不改变图谱镜头。
 * 被调用：GraphHoverPreview；调用：GraphDockPositionField、共享 Popover。
 * 预期结果：应用后移动同一个窗口，Escape 取消草稿。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { FieldGroup } from "@leonwillow-electron/ui/components/field";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@leonwillow-electron/ui/components/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { Settings2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import GraphDockPositionField from "./graph-dock-position-field";
import { defaultPreviewLayout, type PreviewLayout } from "./use-preview-layout";

export default function GraphPreviewSettings({
	layout,
	onChange,
}: {
	layout: PreviewLayout;
	onChange: (layout: PreviewLayout) => void;
}) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState(layout.position);
	const changeOpen = (value: boolean) => {
		if (value) setPosition(layout.position);
		setOpen(value);
	};
	useEffect(() => {
		if (layout.collapsed) setOpen(false);
	}, [layout.collapsed]);
	return (
		<Popover open={open && !layout.collapsed} onOpenChange={changeOpen}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button variant="ghost" size="icon" aria-label="速览窗口设置" />
							}
						/>
					}
				>
					<Settings2Icon />
				</TooltipTrigger>
				<TooltipContent>速览窗口设置</TooltipContent>
			</Tooltip>
			<PopoverContent
				side={layout.position.startsWith("bottom") ? "top" : "bottom"}
				align="end"
				className="w-64 max-w-[calc(100vw-2rem)]"
			>
				<PopoverHeader>
					<PopoverTitle>速览窗口位置</PopoverTitle>
				</PopoverHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						onChange({ ...layout, position });
						changeOpen(false);
					}}
				>
					<FieldGroup>
						<GraphDockPositionField
							label="速览窗口排列位置"
							value={position}
							onChange={setPosition}
						/>
					</FieldGroup>
					<div className="flex justify-between gap-2">
						<Button
							variant="ghost"
							onClick={() => setPosition(defaultPreviewLayout.position)}
						>
							恢复默认
						</Button>
						<Button type="submit">应用位置</Button>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
}
