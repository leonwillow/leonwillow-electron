/**
 * @file 笔录案件文件夹的新建和重命名弹窗。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：沿用工作台共享表单和 Dialog，创建成功后展开目录中的案件。
 * 被调用：笔录案件侧栏与未选择引导；调用：Eden、Sonner、导航上下文。
 * 预期结果：创建文件夹不改变当前编辑笔录，失败保留输入并允许重试。
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
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useInquiryNavigation } from "@/components/layout/inquiry-navigation-provider";
import {
	createInquiryCase,
	type InquiryCase,
	inquiryError,
	updateInquiryCase,
} from "@/lib/inquiries";

export default function InquiryCaseDialog({
	row,
	onClose,
}: {
	row?: InquiryCase;
	onClose: () => void;
}) {
	const [name, setName] = useState(row?.name ?? "");
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const menu = useInquiryNavigation();
	const submit = async () => {
		if (lock.current || !name.trim()) return;
		lock.current = true;
		setBusy(true);
		try {
			const saved = row
				? await updateInquiryCase(row, { name })
				: await createInquiryCase(name);
			if (!row) {
				menu.resetFilters();
				menu.setCaseExpanded(saved.id, true);
			}
			await menu.cases.reload();
			onClose();
			menu.focusPanel();
		} catch (cause) {
			toast.error(inquiryError(cause));
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
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
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
				>
					<DialogHeader>
						<DialogTitle>{row ? "重命名笔录案件" : "新建笔录案件"}</DialogTitle>
						<DialogDescription>
							以文件夹管理案件，在其中创建和整理询问笔录。
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="inquiry-case-name">案件名称</FieldLabel>
							<Input
								id="inquiry-case-name"
								value={name}
								autoFocus
								required
								maxLength={80}
								placeholder="例如：B 案件"
								onChange={(e) => setName(e.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={onClose}
						>
							取消
						</Button>
						<Button type="submit" disabled={busy || !name.trim()}>
							{busy ? "正在保存…" : row ? "保存名称" : "创建案件"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
