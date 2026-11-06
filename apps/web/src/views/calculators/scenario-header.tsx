/**
 * @file 两种计算器的方案名称与保存操作顶栏。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：合并原正文操作行，名称保留可访问标签但不显示额外文字。
 * 被调用：VatEditor、LateFeeEditor；调用：共享工作区标题、Input 和 Button。
 * 预期结果：名称、保存状态和业务操作同行，窄窗换行，归档内容只读。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Input } from "@leonwillow-electron/ui/components/input";
import { SaveIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	WorkspaceHeader,
	WorkspaceTitle,
} from "@/components/layout/workspace-header";
import {
	type CalculatorKind,
	calculatorDirectory,
} from "@/lib/calculator-directory";
export default function ScenarioHeader({
	kind,
	name,
	onNameChange,
	editor,
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
	children?: ReactNode;
}) {
	const config = calculatorDirectory[kind];
	return (
		<WorkspaceHeader>
			<WorkspaceTitle icon={config.icon}>{config.title}</WorkspaceTitle>
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
