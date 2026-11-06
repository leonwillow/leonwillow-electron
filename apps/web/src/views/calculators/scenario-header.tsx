/**
 * @file 两种计算器的方案名称与保存操作顶栏。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：合并原正文操作行，并为标题提供可选的计算口径悬停入口。
 * 被调用：VatEditor、LateFeeEditor；调用：共享工作区标题、HoverCard、ScrollArea、Input 和 Button。
 * 预期结果：名称、保存状态和业务操作同行；说明支持悬停、键盘及触屏查看，长内容有界滚动。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@leonwillow-electron/ui/components/hover-card";
import { Input } from "@leonwillow-electron/ui/components/input";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { CircleHelpIcon, SaveIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";
import {
	type CalculatorKind,
	calculatorDirectory,
} from "@/lib/calculator-directory";

function ScenarioHelp({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const triggerId = useId();
	const contentId = useId();
	return (
		<HoverCard open={open} onOpenChange={setOpen} triggerId={triggerId}>
			<HoverCardTrigger
				id={triggerId}
				render={<button type="button" />}
				className="calculator-help-trigger"
				delay={150}
				closeDelay={100}
				aria-label={`${title}：计算口径与数据来源`}
				aria-expanded={open}
				aria-controls={open ? contentId : undefined}
				onClick={() => setOpen(true)}
			>
				{title}
				<CircleHelpIcon aria-hidden="true" className="calculator-help-icon" />
			</HoverCardTrigger>
			<HoverCardContent
				id={contentId}
				role="region"
				aria-label="计算口径与数据来源"
				align="start"
				sideOffset={8}
				collisionPadding={12}
				className="calculator-help-card p-0"
			>
				<ScrollArea
					className="max-h-(--available-height) rounded-lg"
					contentClassName="flex w-full min-w-0! flex-col gap-3 p-3"
				>
					<p className="font-semibold text-sm">计算口径与数据来源</p>
					{children}
				</ScrollArea>
			</HoverCardContent>
		</HoverCard>
	);
}

export default function ScenarioHeader({
	kind,
	name,
	onNameChange,
	editor,
	help,
	children,
}: {
	kind: CalculatorKind;
	name: string;
	onNameChange: (name: string) => void;
	editor: {
		archived: boolean;
		readOnly: boolean;
		saving: boolean;
		dirty: boolean;
		error: string;
		savedAt: Date | string;
		persist: () => Promise<boolean>;
	};
	help?: ReactNode;
	children?: ReactNode;
}) {
	const config = calculatorDirectory[kind];
	return (
		<WorkspaceHeader>
			<WorkspaceTitle icon={config.icon}>
				{help ? (
					<ScenarioHelp title={config.title}>{help}</ScenarioHelp>
				) : (
					config.title
				)}
			</WorkspaceTitle>
			<div className="flex min-w-0 flex-1 basis-64 items-center">
				<Input
					className="calculator-name-field"
					aria-label="方案名称"
					value={name}
					maxLength={80}
					readOnly={editor.readOnly}
					onChange={(e) => onNameChange(e.target.value)}
				/>
			</div>
			<div
				role="toolbar"
				aria-label="方案操作"
				className="flex flex-wrap items-center gap-2"
			>
				<span role="status" className="text-muted-foreground text-xs">
					{editor.archived
						? "已归档 · 只读"
						: editor.error
							? "保存失败 · 输入仍保留"
							: editor.saving
								? "正在保存…"
								: editor.dirty
									? "待自动保存"
									: `已保存 ${new Date(editor.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
				</span>
				<Button
					variant="outline"
					disabled={editor.readOnly || editor.saving}
					disabledReason={
						editor.archived ? "请先在目录中恢复方案" : "正在处理当前方案"
					}
					onClick={() => void editor.persist()}
				>
					<SaveIcon data-icon="inline-start" />
					保存
				</Button>
				{children}
			</div>
		</WorkspaceHeader>
	);
}
