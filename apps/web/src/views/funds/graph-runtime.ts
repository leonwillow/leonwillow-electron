/**
 * @file 按需加载 G6、Canvas 渲染器及资金图实际使用的扩展子集。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-21
 * 版本作用：按需注册资金画布用到的节点、边、交互、插件、主题与核心变换，避免引入全量布局与冗余插件包。
 * 被调用：graph-canvas；调用：G6 细粒度 ESM 子模块与 G Canvas 渲染接口。
 * 预期结果：主题更新分批执行，拖动仍走默认处理，尺寸标记由连线批次更新端点，并显著缩小画布按需 chunk 体积。
 */
import type { DrawData, Graph as G6Graph } from "@antv/g6";
import { DragCanvas } from "@antv/g6/esm/behaviors/drag-canvas";
import { DragElement } from "@antv/g6/esm/behaviors/drag-element";
import { HoverActivate } from "@antv/g6/esm/behaviors/hover-activate";
import { ZoomCanvas } from "@antv/g6/esm/behaviors/zoom-canvas";
import { ExtensionCategory } from "@antv/g6/esm/constants";
import { Line } from "@antv/g6/esm/elements/edges/line";
import { Quadratic } from "@antv/g6/esm/elements/edges/quadratic";
import { Circle } from "@antv/g6/esm/elements/nodes/circle";
import { Diamond } from "@antv/g6/esm/elements/nodes/diamond";
import { Hexagon } from "@antv/g6/esm/elements/nodes/hexagon";
import { Rect } from "@antv/g6/esm/elements/nodes/rect";
import { Triangle } from "@antv/g6/esm/elements/nodes/triangle";
import { Badge } from "@antv/g6/esm/elements/shapes/badge";
import { Image as ImageShape } from "@antv/g6/esm/elements/shapes/image";
import { Label } from "@antv/g6/esm/elements/shapes/label";
import { Toolbar } from "@antv/g6/esm/plugins/toolbar";
import { register } from "@antv/g6/esm/registry/register";
import { Graph as RuntimeGraph } from "@antv/g6/esm/runtime/graph";
import { dark } from "@antv/g6/esm/themes/dark";
import { light } from "@antv/g6/esm/themes/light";
import { ArrangeDrawOrder } from "@antv/g6/esm/transforms/arrange-draw-order";
import {
	BaseTransform,
	type BaseTransformOptions,
} from "@antv/g6/esm/transforms/base-transform";
import { CollapseExpandCombo } from "@antv/g6/esm/transforms/collapse-expand-combo";
import { CollapseExpandNode } from "@antv/g6/esm/transforms/collapse-expand-node";
import { GetEdgeActualEnds } from "@antv/g6/esm/transforms/get-edge-actual-ends";
import { UpdateRelatedEdge } from "@antv/g6/esm/transforms/update-related-edge";

class FundsNodeStyle extends BaseTransform<
	BaseTransformOptions & { nodeStyleOnly: () => boolean }
> {
	beforeDraw(input: DrawData) {
		// 仅用于 renderer 的节点样式批次；所有显式及几何变化连线在后续批次执行。
		if (this.options.nodeStyleOnly()) input.update.edges.clear();
		return input;
	}
}

// 仅注册资金画布用到的扩展与 G6 运行时必需的核心变换，跳过 19 套布局与 17 个未用插件。
register(ExtensionCategory.THEME, "light", light);
register(ExtensionCategory.THEME, "dark", dark);
register(ExtensionCategory.SHAPE, "label", Label);
register(ExtensionCategory.SHAPE, "badge", Badge);
register(ExtensionCategory.SHAPE, "image", ImageShape);
register(ExtensionCategory.NODE, "circle", Circle);
register(ExtensionCategory.NODE, "rect", Rect);
register(ExtensionCategory.NODE, "diamond", Diamond);
register(ExtensionCategory.NODE, "triangle", Triangle);
register(ExtensionCategory.NODE, "hexagon", Hexagon);
register(ExtensionCategory.EDGE, "quadratic", Quadratic);
register(ExtensionCategory.EDGE, "line", Line);
register(ExtensionCategory.BEHAVIOR, "drag-canvas", DragCanvas);
register(ExtensionCategory.BEHAVIOR, "zoom-canvas", ZoomCanvas);
register(ExtensionCategory.BEHAVIOR, "drag-element", DragElement);
register(ExtensionCategory.BEHAVIOR, "hover-activate", HoverActivate);
register(ExtensionCategory.PLUGIN, "toolbar", Toolbar);
register(
	ExtensionCategory.TRANSFORM,
	"update-related-edges",
	UpdateRelatedEdge,
);
register(
	ExtensionCategory.TRANSFORM,
	"collapse-expand-node",
	CollapseExpandNode,
);
register(
	ExtensionCategory.TRANSFORM,
	"collapse-expand-combo",
	CollapseExpandCombo,
);
register(
	ExtensionCategory.TRANSFORM,
	"get-edge-actual-ends",
	GetEdgeActualEnds,
);
register(ExtensionCategory.TRANSFORM, "arrange-draw-order", ArrangeDrawOrder);
register(ExtensionCategory.TRANSFORM, "funds-node-style", FundsNodeStyle);

export { Renderer as CanvasRenderer } from "@antv/g-canvas";
// 运行时来自细粒度 esm 子路径，类型对齐 @antv/g6 根声明以兼容全仓库 import type。
export const Graph = RuntimeGraph as unknown as typeof G6Graph;
