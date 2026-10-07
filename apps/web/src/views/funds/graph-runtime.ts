/**
 * @file 按需加载 G6、Canvas 渲染器及资金图的样式变换。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：节点样式更新不重复重算所有关联边，尺寸变化涉及的连线由 renderer 分批更新。
 * 被调用：graph-canvas；调用：G6 官方 BaseTransform 与 G Canvas 渲染接口。
 * 预期结果：主题更新分批执行，拖动仍走默认处理，尺寸标记由连线批次更新端点。
 */
import {
	BaseTransform,
	type BaseTransformOptions,
	type DrawData,
	ExtensionCategory,
	register,
} from "@antv/g6";

class FundsNodeStyle extends BaseTransform<
	BaseTransformOptions & { nodeStyleOnly: () => boolean }
> {
	beforeDraw(input: DrawData) {
		// 仅用于 renderer 的节点样式批次；所有显式及几何变化连线在后续批次执行。
		if (this.options.nodeStyleOnly()) input.update.edges.clear();
		return input;
	}
}
register(ExtensionCategory.TRANSFORM, "funds-node-style", FundsNodeStyle);

export { Renderer as CanvasRenderer } from "@antv/g-canvas";
export { Graph } from "@antv/g6";
