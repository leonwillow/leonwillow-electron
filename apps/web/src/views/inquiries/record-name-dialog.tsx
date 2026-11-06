/**
 * @file 单份笔录的重命名弹窗。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：复用案件名称表单结构；由目录统一协调编辑器保存、锁和修订号。
 * 被调用：useInquiryCaseMenu；调用：共享 Dialog、Field、Input、Button。
 * 预期结果：失败保留输入，提交期间禁止关闭，成功后目录及编辑标题同步。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { Field, FieldLabel } from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { useState } from "react";
export default function InquiryRecordNameDialog({
	title,
	busy,
	onSubmit,
	onClose,
}: {
	title: string;
	busy: boolean;
	onSubmit: (title: string) => Promise<void>;
	onClose: () => void;
}) {
	const [name, setName] = useState(title);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
		>
			<DialogContent>
				<form
					className="flex flex-col gap-5"
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						if (!busy && name.trim()) void onSubmit(name.trim());
					}}
				>
					<DialogHeader>
						<DialogTitle>重命名笔录</DialogTitle>
						<DialogDescription>
							修改这份笔录在目录和编辑器中的名称。
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="inquiry-record-name">笔录名称</FieldLabel>
						<Input
							id="inquiry-record-name"
							autoFocus
							value={name}
							maxLength={80}
							disabled={busy}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={onClose}
						>
							取消
						</Button>
						<Button
							type="submit"
							disabled={busy || !name.trim()}
							disabledReason={busy ? "正在保存名称" : "请输入笔录名称"}
						>
							{busy ? "正在保存…" : "保存名称"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
