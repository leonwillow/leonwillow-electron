/**
 * @file 节点与连线共用的非模态详情侧栏。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：选中对象变化只替换内容，保留同一个 Sheet 和关闭控件。
 * 被调用：AnalysisPanel；调用：NodeInspector、EdgeInspector、共享 Sheet。
 * 功能：统一详情容器、节点标记入口和连线来源核对；内容切换轻微淡入。
 * 预期结果：连续选择不会重新播放侧栏入场；对象相关编辑、分页和请求隔离。
 */
import { Sheet, SheetContent } from "@leonwillow-electron/ui/components/sheet";
import type { FundsAccount } from "@/lib/funds";
import type { AnalysisEdge, NodeMode, RawGraph } from "@/lib/funds-analysis";
import type {
	NodeMark,
	NodePresentation,
} from "@/lib/funds-graph-presentation";
import EdgeInspector from "./edge-inspector";
import NodeInspector from "./node-inspector";

export type InspectorTarget =
	| { kind: "node"; id: string; tab: "details" | "mark" }
	| { kind: "edge"; id: string };

export type InspectorSelection =
	| { kind: "node"; node: FundsAccount; tab: "details" | "mark" }
	| { kind: "edge"; edge: AnalysisEdge };

export default function GraphInspector({
	selection,
	caseId,
	mode,
	full,
	presentation,
	onClose,
	onTabChange,
	onDrill,
	onHide,
	onMark,
	onReset,
	onEdge,
}: {
	selection: InspectorSelection;
	caseId: string;
	mode: NodeMode;
	full: RawGraph;
	presentation?: NodePresentation;
	onClose: () => void;
	onTabChange: (tab: "details" | "mark") => void;
	onDrill: () => void;
	onHide: () => void;
	onMark: (mark: NodeMark) => void;
	onReset: () => void;
	onEdge: (id: string) => void;
}) {
	const contentKey =
		selection.kind === "node"
			? `node:${mode}:${selection.node.id}`
			: `edge:${selection.edge.id}`;
	return (
		<Sheet
			open
			modal={false}
			disablePointerDismissal
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent
				showOverlay={false}
				initialFocus={false}
				finalFocus={false}
				className="motion-reduce:animate-none sm:max-w-[25rem]"
			>
				{/* key 只重置当前对象的正文；外层侧栏与关闭按钮始终复用。 */}
				<div
					key={contentKey}
					className="funds-inspector-content flex min-h-0 flex-1 flex-col"
				>
					{selection.kind === "node" ? (
						<NodeInspector
							node={selection.node}
							mode={mode}
							full={full}
							presentation={presentation}
							tab={selection.tab}
							onTabChange={onTabChange}
							onDrill={onDrill}
							onHide={onHide}
							onMark={onMark}
							onReset={onReset}
						/>
					) : (
						<EdgeInspector
							edge={selection.edge}
							caseId={caseId}
							mode={mode}
							full={full}
							onEdge={onEdge}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
