/**
 * @file 保留正文外观的点击复制文本。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：名称、账号与金额共用复制提示和反馈，不改变所在文字层级。
 * 被调用：资金节点详情与账户速览；调用：Tooltip、Clipboard API、全局 Sonner。
 * 功能：悬停下划线和完整值提示；复制原始 value，成功后通知，失败显示手动复制提示。
 * 预期结果：单行截断保留下划线，鼠标和键盘均可复制；失败不会误报成功。
 */
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { toast } from "sonner";

export function CopyText({
	value,
	className,
}: {
	value: string;
	className?: string;
}) {
	const hint = `点击复制：${value}`;
	return (
		<Tooltip>
			<TooltipTrigger
				closeOnClick={false}
				render={
					<button
						type="button"
						data-slot="copy-text"
						aria-label={hint}
						className={cn(
							"inline-block max-w-full cursor-pointer rounded-sm text-left align-baseline underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/30",
							className,
						)}
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(value);
								toast.success("复制成功", {
									id: "copy-text",
									duration: 1500,
									richColors: true,
								});
							} catch {
								toast.error("复制失败，请选择文本手动复制。", {
									id: "copy-text",
								});
							}
						}}
					>
						{value}
					</button>
				}
			/>
			<TooltipContent className="break-all">{hint}</TooltipContent>
		</Tooltip>
	);
}
