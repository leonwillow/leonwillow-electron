/**
 * @file 主题分析面板的「元素层级（Layers）」语义树视图。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：紧凑呈现当前检视元素的语义祖先链与直接子级，去除冗余说明文案，点击任一层级即时切换锁定目标。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：cn、lucide-react。
 * 功能：按缩进层级展示中文语义名称、选择器与关键语义令牌，悬停高亮对应画布区域。
 * 预期结果：界面清爽紧凑，管理员可快速在父子组件间穿梭。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { CornerDownRightIcon, LayersIcon } from "lucide-react";
import type { LayerTreeNode } from "./theme-inspector-types";

export function InspectorLayersTab({
	layers,
	onSelectElement,
	onHoverElement,
}: {
	layers: LayerTreeNode[];
	onSelectElement: (element: HTMLElement) => void;
	onHoverElement: (element: HTMLElement | null) => void;
}) {
	if (layers.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground text-xs">
				<LayersIcon className="size-5 opacity-45" aria-hidden="true" />
				<p>悬停页面元素以显示语义层级</p>
			</div>
		);
	}

	return (
		<ul className="flex flex-col gap-1 p-3">
			{layers.map((node, index) => {
				const isCurrent = node.relation === "current";
				const indentPx = Math.min(node.depth, 7) * 12;
				return (
					<li key={`${node.tagLabel}-${index}`}>
						<button
							type="button"
							onClick={() => onSelectElement(node.element)}
							onPointerEnter={() => onHoverElement(node.element)}
							onPointerLeave={() => onHoverElement(null)}
							style={{ paddingLeft: `${indentPx + 8}px` }}
							className={cn(
								"flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors",
								isCurrent
									? "border-primary/40 bg-accent text-accent-foreground"
									: "border-transparent bg-background/50 text-foreground hover:border-border hover:bg-muted/70",
							)}
						>
							<div className="flex min-w-0 items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-1.5">
									{node.depth > 0 && (
										<CornerDownRightIcon
											className="size-3 shrink-0 opacity-50"
											aria-hidden="true"
										/>
									)}
									<span className="truncate font-medium text-xs">
										{node.semanticLabel}
									</span>
								</div>
								<span className="shrink-0 font-mono text-caption text-muted-foreground">
									{node.tagLabel}
								</span>
							</div>
							{node.tokenHints.length > 0 && (
								<div className="flex flex-wrap items-center gap-1 pl-4 font-mono text-caption text-muted-foreground">
									{node.tokenHints.map((hint) => (
										<span
											key={hint}
											className="rounded-xs bg-muted px-1 text-foreground/80"
										>
											{hint}
										</span>
									))}
								</div>
							)}
						</button>
					</li>
				);
			})}
		</ul>
	);
}
