/**
 * @file 标题旁的轻量问号悬浮说明按钮。
 * 创建时间：2026-11-19；修改时间：2026-11-19。
 * 版本作用：将业务口径与补充规则收拢为按需可见的悬浮提示，减少常驻辅助段落对界面的干扰。
 * 被调用：资金分析及各业务标题行。
 * 调用：./button、./tooltip、lucide-react。
 * 功能：提供键盘可聚焦与鼠标可悬停的问号图标按钮，并在弹层中展示完整中文说明。
 * 预期结果：界面清爽紧凑，规则说明不丢失且具备完整无障碍名称。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { CircleHelpIcon } from "lucide-react";
import type { ReactNode } from "react";

function HelpTip({
	label,
	content,
	side = "top",
}: {
	label: string;
	content: ReactNode;
	side?: "top" | "right" | "bottom" | "left";
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label={label}
						className="text-muted-foreground hover:text-foreground"
					/>
				}
			>
				<CircleHelpIcon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent side={side} className="max-w-72 leading-relaxed">
				{content}
			</TooltipContent>
		</Tooltip>
	);
}

export { HelpTip };
