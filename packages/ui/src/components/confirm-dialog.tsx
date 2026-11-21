/**
 * @file 通用确认与离开拦截对话框基础组件。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-21
 * 版本作用：统一全站删除确认、清空确认与未保存离开拦截弹窗的防误关锁、错误提示与底部按钮布局。
 * 被调用：笔录、文书、计算器、资金案件菜单与自定义主题面板。
 * 调用：ui Dialog 与 Button 基础组件。
 * 功能：提供标题、说明、可选错误告警、繁忙锁定及可定制主次操作按钮。
 * 预期结果：busy 期间阻止背景或 Escape 关闭，保持无障碍角色与按钮焦点语义一致。
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
import type { ComponentProps, ReactNode } from "react";

type ButtonProps = ComponentProps<typeof Button>;

function ConfirmDialog({
	open,
	title,
	children,
	confirmLabel = "确认删除",
	busyLabel,
	cancelLabel = "取消",
	confirmVariant = "destructive-solid",
	cancelVariant = "outline",
	buttonSize = "default",
	busy = false,
	disabled = false,
	showCloseButton = false,
	error,
	extraActions,
	onClose,
	onConfirm,
}: {
	open: boolean;
	title: string;
	children: ReactNode;
	confirmLabel?: string;
	busyLabel?: string;
	cancelLabel?: string;
	confirmVariant?: ButtonProps["variant"];
	cancelVariant?: ButtonProps["variant"];
	buttonSize?: ButtonProps["size"];
	busy?: boolean;
	disabled?: boolean;
	showCloseButton?: boolean;
	error?: string;
	extraActions?: ReactNode;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !busy) onClose();
			}}
		>
			<DialogContent showCloseButton={showCloseButton && !busy}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{children}</DialogDescription>
				</DialogHeader>
				{error && (
					<p role="alert" className="text-destructive-foreground text-xs">
						{error}
					</p>
				)}
				<DialogFooter>
					{extraActions}
					<Button
						type="button"
						size={buttonSize}
						variant={cancelVariant}
						disabled={busy}
						onClick={onClose}
					>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						size={buttonSize}
						variant={confirmVariant}
						disabled={busy || disabled}
						onClick={onConfirm}
					>
						{busy ? (busyLabel ?? confirmLabel) : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { ConfirmDialog };
