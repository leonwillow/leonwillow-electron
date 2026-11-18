/**
 * @file 笔录工作区共用的删除确认与异步状态提示。
 * 创建时间：2026-11-04；修改时间：2026-11-18。
 * 版本作用：图标按钮已上移至 packages/ui TooltipIconButton，本文件仅保留笔录局部加载/错误提示与删除确认。
 * 被调用：笔录页面；调用：共享 Button/Dialog。
 * 预期结果：异步失败可重试，删除明确确认且进行中不能重复提交。
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
import type { ReactNode } from "react";

export function InquiryState({
	loading,
	error,
	retry,
}: {
	loading: boolean;
	error: string;
	retry: () => unknown;
}) {
	if (error)
		return (
			<div className="flex flex-col items-start gap-3 p-workspace-gutter">
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
				<Button variant="outline" onClick={() => void retry()}>
					重新加载
				</Button>
			</div>
		);
	if (loading)
		return (
			<p
				role="status"
				className="p-workspace-gutter text-muted-foreground text-sm"
			>
				正在加载…
			</p>
		);
	return null;
}

export function InquiryConfirm({
	title,
	children,
	open,
	busy,
	error,
	onClose,
	onConfirm,
}: {
	title: string;
	children: ReactNode;
	open: boolean;
	busy: boolean;
	error: string;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!value && !busy) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{children}</DialogDescription>
				</DialogHeader>
				{error && (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				)}
				<DialogFooter>
					<Button variant="outline" disabled={busy} onClick={onClose}>
						取消
					</Button>
					<Button variant="destructive" disabled={busy} onClick={onConfirm}>
						{busy ? "正在处理…" : "确认删除"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
