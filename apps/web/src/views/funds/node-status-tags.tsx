/**
 * @file 资金节点资料与标记的语义状态标签。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：预览卡与详情面板共用标签含义和配色。
 * 被调用：AccountDirectoryRow、NodeInspector；调用：共享 Badge。
 * 功能：绿色表示已有流水，黄色提示待补，红色提示户名冲突，主题色表示特殊标记。
 * 预期结果：颜色辅助识别，始终保留文字说明，不在账户列表占用额外一行。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import type { FundsAccount } from "@/lib/funds";
import type { NodePresentation } from "@/lib/funds-graph-presentation";

export default function NodeStatusTags({
	node,
	presentation,
}: {
	node: FundsAccount;
	presentation?: NodePresentation;
}) {
	return (
		<div className="flex flex-wrap gap-1">
			{node.hasStatement ? (
				<Badge variant="success">已有本方流水</Badge>
			) : (
				<>
					<Badge variant="secondary">仅见交易对手</Badge>
					<Badge variant="warning">待补流水</Badge>
				</>
			)}
			{node.ownNames.length > 1 && (
				<Badge variant="destructive">户名冲突</Badge>
			)}
			{presentation?.marked && <Badge>已特殊标记</Badge>}
			{presentation?.hidden && <Badge variant="secondary">已在画布隐藏</Badge>}
		</div>
	);
}
