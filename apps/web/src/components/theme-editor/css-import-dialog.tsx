/**
 * @file 主题 CSS 的输入和错误反馈对话框。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-05
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/theme-editor/theme-control-panel.tsx。
 * 调用：ui 基础组件/样式、react。
 * 功能：收集文本，调用导入边界并显示解析失败原因。
 * 预期结果：只有导入成功才清空输入并关闭，主题仍需另行保存。
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
	FieldError,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import { useState } from "react";

type CssImportDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImport: (css: string) => void;
};

const CssImportDialog = ({
	open,
	onOpenChange,
	onImport,
}: CssImportDialogProps) => {
	const [cssText, setCssText] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleImport = () => {
		if (!cssText.trim()) {
			setError("请粘贴 CSS 主题变量。");

			return;
		}

		try {
			if (!cssText.includes("--") || !cssText.includes(":")) {
				setError("请输入有效的 CSS 变量，如 --primary: #007f99;");

				return;
			}

			onImport(cssText);
			setCssText("");
			setError(null);
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "无法解析 CSS，请检查变量格式。",
			);
		}
	};

	const handleClose = () => {
		setCssText("");
		setError(null);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				scrollable
				className="max-h-[90dvh] sm:max-w-xl"
				scrollContentClassName=""
			>
				<DialogHeader>
					<DialogTitle className="text-foreground">导入 CSS 主题</DialogTitle>
					<DialogDescription>
						粘贴 shadcn Studio 或本项目导出的 :root 和 .dark
						主题变量。导入后先预览，点击保存才会写入主题库。
					</DialogDescription>
				</DialogHeader>

				<Field data-invalid={!!error}>
					<FieldLabel htmlFor="theme-import-css">CSS 主题变量</FieldLabel>
					<Textarea
						id="theme-import-css"
						aria-invalid={!!error}
						placeholder={`:root {
  --background: 0 0% 100%;
  --foreground: oklch(0.52 0.13 144.17);
  --primary: #3e2723;
  /* 更多颜色 */
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: hsl(37.50 36.36% 95.69%);
  --primary: rgb(46, 125, 50);
  /* 更多颜色 */
}
  `}
						className="min-h-48 font-mono"
						value={cssText}
						onChange={(e) => {
							setCssText(e.target.value);
							if (error) setError(null);
						}}
					/>
					{error && <FieldError>{error}</FieldError>}
				</Field>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleClose}
						className="cursor-pointer text-foreground"
					>
						取消
					</Button>
					<Button onClick={handleImport} className="cursor-pointer">
						导入预览
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default CssImportDialog;
