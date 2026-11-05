/**
 * @file 可停靠、可折叠的画布悬停速览。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-05
 * 版本作用：独立于 G6 绘制生命周期，仅消费已加载数据；鼠标交互不重绘图谱。
 * 被调用：GraphCanvas 通过 ref.show 转交图元进入事件。
 * 功能：按帧合并目标、缓存本地摘要、点击切换展开与折叠、独立保存布局。
 * 预期结果：无悬停请求；换图拒绝旧目标，折叠仍是同一个面板，退出时清理调度。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Card,
	CardAction,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@leonwillow-electron/ui/components/collapsible";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { ChevronsDownUpIcon, ScanEyeIcon } from "lucide-react";
import {
	type Ref,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { AnalysisGraph, NodeMode } from "@/lib/funds-analysis";
import type { GraphPresentation } from "@/lib/funds-graph-presentation";
import {
	createGraphPreviewIndex,
	type GraphPreviewTarget,
} from "@/lib/funds-graph-preview";
import GraphPreviewContent from "./graph-preview-content";
import GraphPreviewSettings from "./graph-preview-settings";
import { usePreviewLayout } from "./use-preview-layout";

export type GraphHoverPreviewHandle = {
	show: (target: GraphPreviewTarget) => void;
};

export default function GraphHoverPreview({
	ref,
	userId,
	data,
	mode,
	presentation,
	ready,
	error,
}: {
	ref: Ref<GraphHoverPreviewHandle>;
	userId: string;
	data: AnalysisGraph;
	mode: NodeMode;
	presentation: GraphPresentation;
	ready: boolean;
	error: string;
}) {
	const index = useMemo(() => createGraphPreviewIndex(data), [data]);
	const [selection, setSelection] = useState<{
		index: typeof index;
		target: GraphPreviewTarget;
	} | null>(null);
	const frame = useRef(0);
	const pending = useRef<GraphPreviewTarget | null>(null);
	useImperativeHandle(
		ref,
		() => ({
			show(target) {
				pending.current = target;
				if (frame.current) return;
				frame.current = requestAnimationFrame(() => {
					frame.current = 0;
					const next = pending.current;
					if (next)
						setSelection((previous) =>
							previous?.index === index &&
							previous.target.kind === next.kind &&
							previous.target.id === next.id
								? previous
								: { index, target: next },
						);
				});
			},
		}),
		[index],
	);
	// 换图必须作废上一份索引排队的悬停，避免旧目标晚于新图提交。
	// biome-ignore lint/correctness/useExhaustiveDependencies: index 是待提交目标所属视图的生命周期。
	useEffect(
		() => () => {
			cancelAnimationFrame(frame.current);
			frame.current = 0;
			pending.current = null;
		},
		[index],
	);
	const preview =
		ready && selection?.index === index ? index.get(selection.target) : null;
	const { layout, save, error: storageError } = usePreviewLayout(userId);
	const expandButton = useRef<HTMLButtonElement>(null);
	const collapseButton = useRef<HTMLButtonElement>(null);
	const restoreFocus = useRef(false);
	const open = !layout.collapsed;
	const [y, x] = layout.position.split("-");
	const changeOpen = (next: boolean) => {
		restoreFocus.current = true;
		save({ ...layout, collapsed: !next });
	};
	// 切换时将焦点交给当前可见的控件，避免焦点留在 inert 的内容中。
	useLayoutEffect(() => {
		if (!restoreFocus.current) return;
		restoreFocus.current = false;
		(open ? collapseButton : expandButton).current?.focus({
			preventScroll: true,
		});
	}, [open]);
	return (
		<Collapsible
			open={open}
			onOpenChange={changeOpen}
			className="funds-graph-preview"
			role="region"
			aria-label="画布悬停速览"
			data-dock-x={x}
			data-dock-y={y}
		>
			<Tooltip disabled={open}>
				<TooltipTrigger
					render={
						<CollapsibleTrigger
							render={
								<Button
									ref={expandButton}
									variant="outline"
									size="icon-lg"
									className="funds-graph-preview-dock funds-graph-preview-expand"
									aria-label="展开悬停速览"
									aria-hidden={open}
									inert={open}
									tabIndex={open ? -1 : 0}
								/>
							}
						/>
					}
				>
					<ScanEyeIcon />
				</TooltipTrigger>
				<TooltipContent
					side={
						x === "right"
							? "left"
							: x === "left"
								? "right"
								: y === "top"
									? "bottom"
									: "top"
					}
				>
					展开悬停速览
				</TooltipContent>
			</Tooltip>
			<CollapsibleContent
				keepMounted
				inert={!open}
				render={
					<Card
						size="sm"
						className="funds-graph-preview-dock funds-graph-preview-panel"
					/>
				}
			>
				<CardHeader className="items-center p-2">
					<CardTitle>悬停速览</CardTitle>
					<CardAction className="flex items-center gap-0.5">
						<GraphPreviewSettings layout={layout} onChange={save} />
						<Tooltip disabled={!open}>
							<TooltipTrigger
								render={
									<Button
										ref={collapseButton}
										variant="ghost"
										size="icon"
										aria-label="折叠速览"
										onClick={() => changeOpen(false)}
									/>
								}
							>
								<ChevronsDownUpIcon />
							</TooltipTrigger>
							<TooltipContent>折叠速览</TooltipContent>
						</Tooltip>
					</CardAction>
				</CardHeader>
				<ScrollArea className="min-h-0" contentClassName="px-3 pb-3">
					{preview ? (
						<GraphPreviewContent
							preview={preview}
							mode={mode}
							presentation={presentation}
						/>
					) : (
						<p className="py-3 text-muted-foreground">
							{error
								? "图谱暂不可用。"
								: !ready
									? "图谱加载中…"
									: data.nodes.length
										? "将鼠标移到节点或连线上，查看基础信息。"
										: "当前视图没有节点或连线。"}
						</p>
					)}
					{preview && (
						<p className="mt-3 text-caption text-muted-foreground">
							最近悬停 · 当前视图
						</p>
					)}
					{storageError && (
						<p role="alert" className="mt-3 text-destructive">
							{storageError}
						</p>
					)}
				</ScrollArea>
			</CollapsibleContent>
		</Collapsible>
	);
}
