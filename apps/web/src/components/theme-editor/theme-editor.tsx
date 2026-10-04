/**
 * @file 完整主题编辑器的浮动外壳。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/root-layout.tsx。
 * 调用：ui 基础组件/样式、lucide-react、stores/theme-store、./theme-control-panel。
 * 功能：连接打开状态、拖动标题、说明和关闭后的焦点恢复。
 * 预期结果：编辑区域可跨路由保留，关闭后回到触发按钮。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { FloatingDialogContent } from "@leonwillow-electron/ui/components/floating-dialog";
import { MoveIcon } from "lucide-react";
import { useThemeStore } from "@/stores/theme-store";
import ThemeControlPanel from "./theme-control-panel";

export default function ThemeEditor() {
	const open = useThemeStore((state) => state.themeEditorOpen);
	const setThemeEditorOpen = useThemeStore((state) => state.setThemeEditorOpen);
	return (
		<Dialog
			open={open}
			onOpenChange={(open) => setThemeEditorOpen(open)}
			modal={false}
			disablePointerDismissal
		>
			<FloatingDialogContent
				finalFocus={() =>
					useThemeStore.getState().themeEditorTrigger?.current ?? false
				}
			>
				<DialogHeader
					data-floating-drag-handle
					className="shrink-0 cursor-grab touch-none select-none border-b p-4 pr-12 active:cursor-grabbing"
				>
					<div className="flex items-center gap-2">
						<Button
							data-floating-drag-handle
							size="icon-sm"
							variant="ghost"
							className="cursor-grab active:cursor-grabbing"
							aria-label="移动主题面板，方向键调整位置"
						>
							<MoveIcon />
						</Button>
						<DialogTitle>自定义主题</DialogTitle>
					</div>
					<DialogDescription>
						为浅色和深色分别调色，实时预览。拖动标题栏可移动面板。
					</DialogDescription>
				</DialogHeader>
				{open && (
					<ThemeControlPanel onClose={() => setThemeEditorOpen(false)} />
				)}
			</FloatingDialogContent>
		</Dialog>
	);
}
