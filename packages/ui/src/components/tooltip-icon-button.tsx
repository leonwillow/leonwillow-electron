/**
 * @file 带中文无障碍名称与即时悬浮提示的共享图标按钮。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：统一工作台目录、笔录工具栏、资金案件与虚拟网格中的纯图标操作按钮。
 * 被调用：packages/lattice-grid、apps/web 导航目录与各业务视图。
 * 调用：./button、./tooltip。
 * 功能：默认挂载 aria-label、禁用焦点保留及禁用原因提示，鼠标移开即收起提示。
 * 预期结果：消除各业务模块重复封装的图标按钮，保证统一的无障碍名称与尺寸令牌。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import type { ComponentProps } from "react";

type TooltipIconButtonProps = Omit<
	ComponentProps<typeof Button>,
	"aria-label"
> & {
	label: string;
	keepTooltipOnClick?: boolean;
};

function TooltipIconButton({
	label,
	children,
	disabledReason,
	keepTooltipOnClick = false,
	focusableWhenDisabled = true,
	type = "button",
	variant = "ghost",
	size = "icon",
	...props
}: TooltipIconButtonProps) {
	return (
		<Tooltip disableHoverablePopup>
			<TooltipTrigger
				closeOnClick={!keepTooltipOnClick}
				render={
					<Button
						focusableWhenDisabled={focusableWhenDisabled}
						type={type}
						variant={variant}
						size={size}
						aria-label={label}
						disabledReason={disabledReason}
						{...props}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>
				{props.disabled ? (disabledReason ?? "当前操作暂不可用") : label}
			</TooltipContent>
		</Tooltip>
	);
}

export { TooltipIconButton, type TooltipIconButtonProps };
