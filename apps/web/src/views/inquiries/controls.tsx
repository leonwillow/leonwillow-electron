/**
 * @file 笔录工作区共用的图标操作、确认和状态提示。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：组合现有 Base UI，保留中文名称、焦点和共享尺寸。
 * 被调用：笔录页面及案件侧栏；调用：共享 Button/Dialog/Tooltip。
 * 预期结果：操作提示在离开按钮时关闭；异步失败可重试，删除明确确认且进行中不能重复提交。
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
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import type { ComponentProps, ReactNode } from "react";

export function InquiryIconButton({
	label,
	children,
	disabledReason,
	...props
}: ComponentProps<typeof Button> & { label: string }) {
	return (
		<Tooltip disableHoverablePopup>
			<TooltipTrigger
				render={
					<Button
						focusableWhenDisabled
						type="button"
						variant="ghost"
						size="icon"
						aria-label={label}
						{...props}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>
				{props.disabled ? (disabledReason ?? "当前操作暂不可用") : label}
			</TooltipContent>
		</Tooltip>
	);
}
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
