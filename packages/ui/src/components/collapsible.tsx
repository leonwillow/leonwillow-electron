/**
 * @file 折叠内容的基础组件，沿用原模板 Base UI 组合。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：透传可访问展开状态、测量高度与动画生命周期。
 * 被调用：GraphHoverPreview；调用：@base-ui/react/collapsible。
 * 预期结果：同一个面板平滑展开，关闭内容退出键盘顺序。
 */
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

function Collapsible(props: CollapsiblePrimitive.Root.Props) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}
function CollapsibleTrigger(props: CollapsiblePrimitive.Trigger.Props) {
	return (
		<CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
	);
}
function CollapsibleContent(props: CollapsiblePrimitive.Panel.Props) {
	return (
		<CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
	);
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
