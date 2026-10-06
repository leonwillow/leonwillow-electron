/**
 * @file Neo4j 查询结果的 G6 画布。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：只绘制返回的规范交易，平行边保持独立交易 ID。
 * 被调用：analysis-panel；调用：按需加载的 G6、共享主题令牌。
 * 功能：账户与交易选择、缩放平移、自动适配容器与主题。
 * 预期结果：销毁旧实例，画布外提供同等可操作的账户/交易列表。
 */
import type { Graph, IPointerEvent } from "@antv/g6";
import { Button } from "@leonwillow-electron/ui/components/button";
import { MaximizeIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { accountName, type FundsGraph, formatFunds } from "@/lib/funds";

export default function GraphCanvas({
	data,
	onAccount,
	onTransaction,
}: {
	data: Pick<FundsGraph, "nodes" | "edges">;
	onAccount: (id: string) => void;
	onTransaction: (id: string) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const graphRef = useRef<Graph | null>(null);
	const [error, setError] = useState("");
	const accountEvent = useEffectEvent(onAccount);
	const transactionEvent = useEffectEvent(onTransaction);
	useEffect(() => {
		const container = host.current;
		if (!container) return;
		let disposed = false;
		let drawRevision = 0;
		let resize: ResizeObserver | undefined;
		let observer: MutationObserver | undefined;
		const draw = async (revision: number) => {
			const { Graph } = await import("@antv/g6");
			if (disposed || revision !== drawRevision) return;
			const style = getComputedStyle(container);
			const root = getComputedStyle(document.documentElement);
			// Canvas 不继承 CSS 字体和颜色，显式从共享令牌取值，随主题重建。
			const color = (token: string) => style.getPropertyValue(token).trim();
			const unit = Number.parseFloat(root.fontSize);
			const graph = new Graph({
				container,
				autoResize: true,
				animation: false,
				autoFit: "view",
				padding: 48,
				data: {
					nodes: data.nodes.map((a) => ({
						id: a.id,
						data: { account: a },
						style: {
							labelText: `${accountName(a).length > 12 ? `${accountName(a).slice(0, 12)}…` : accountName(a)}\n${a.number ? `尾号 ${a.number.slice(-4)}` : "账号待核"}`,
							fill: color(a.hasStatement ? "--primary" : "--background"),
							stroke: color(
								a.hasStatement ? "--primary" : "--muted-foreground",
							),
							lineDash: a.hasStatement ? undefined : [4, 3],
							labelFill: color("--foreground"),
						},
					})),
					edges: data.edges.map((t) => ({
						id: t.id,
						source: t.from,
						target: t.to,
						style: {
							labelText:
								data.edges.length <= 24
									? formatFunds(t.amountMinor, t.currency)
									: "",
							stroke: color("--muted-foreground"),
							labelFill: color("--foreground"),
						},
					})),
				},
				node: {
					style: {
						size: 2 * unit,
						lineWidth: 1.5,
						labelPlacement: "bottom",
						labelFontSize: unit * 0.75,
						labelFontFamily: style.fontFamily,
						labelOffsetY: 8,
						cursor: "pointer",
					},
				},
				edge: {
					type: "quadratic",
					style: {
						endArrow: true,
						lineWidth: 1,
						labelFontSize: unit * 0.625,
						labelBackground: true,
						labelBackgroundFill: color("--background"),
						cursor: "pointer",
					},
				},
				layout: {
					type: "circular",
					radius: Math.max(
						150,
						Math.min(container.clientWidth, container.clientHeight) * 0.32,
						// 全量节点按周长留出空间，避免所有节点仍挤在小图的固定半径上。
						(data.nodes.length * 2.5 * unit) / (2 * Math.PI),
					),
				},
				transforms: [
					{ type: "process-parallel-edges", mode: "bundle", distance: 4 },
				],
				behaviors: [
					"drag-canvas",
					"zoom-canvas",
					"drag-element",
					"hover-activate",
				],
			});
			graphRef.current = graph;
			graph.on("node:click", (event: IPointerEvent) => {
				if ("id" in event.target) accountEvent(String(event.target.id));
			});
			graph.on("edge:click", (event: IPointerEvent) => {
				if ("id" in event.target) transactionEvent(String(event.target.id));
			});
			await graph.render();
			if (disposed || revision !== drawRevision) return;
			resize = new ResizeObserver(() => {
				if (!disposed && !graph.destroyed) graph.resize();
			});
			resize.observe(container);
		};
		const redraw = () => {
			const revision = ++drawRevision;
			resize?.disconnect();
			graphRef.current?.destroy();
			graphRef.current = null;
			void draw(revision).catch(() => {
				if (!disposed && revision === drawRevision)
					setError("图形暂时无法绘制，请使用交易明细或刷新页面。");
			});
		};
		redraw();
		observer = new MutationObserver(redraw);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => {
			disposed = true;
			resize?.disconnect();
			observer?.disconnect();
			graphRef.current?.destroy();
			graphRef.current = null;
		};
	}, [data]);
	return (
		<div className="relative rounded-lg border bg-background">
			<div className="absolute top-3 right-3 z-10">
				<Button
					variant="outline"
					size="icon"
					aria-label="适应画布"
					onClick={() => void graphRef.current?.fitView()}
				>
					<MaximizeIcon />
				</Button>
			</div>
			<div
				ref={host}
				role="img"
				className="h-96 min-h-80 w-full lg:h-[30rem]"
				aria-label="账户交易关系图；下方交易明细提供键盘操作"
			/>
			{error && (
				<p
					role="alert"
					className="absolute bottom-4 left-4 bg-background p-2 text-destructive text-xs"
				>
					{error}
				</p>
			)}
		</div>
	);
}
