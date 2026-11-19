/**
 * @file 工作台浏览器全屏开关。
 * 创建时间：2026-11-05；修改时间：2026-11-19。
 * 版本作用：头像上方提供全屏入口，监听真实浏览器状态以同步 Escape 退出。
 * 被调用：AppSidebar；调用：Fullscreen API、Arc FullscreenIcon、共享 Button/Tooltip、Sonner。
 * 预期结果：全屏状态驱动四角连续旋转；宽菜单下展示清晰标签，不支持或拒绝时给出中文原因。
 */
import { FullscreenIcon } from "@leonwillow-electron/ui/components/arc/icon-morph/icon-morph";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
export default function FullscreenToggle({ wide = false }: { wide?: boolean }) {
	const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
	const pending = useRef(false);
	const supported = document.fullscreenEnabled;
	const label = fullscreen ? "退出全屏" : "全屏显示";
	useEffect(() => {
		const sync = () => setFullscreen(!!document.fullscreenElement);
		document.addEventListener("fullscreenchange", sync);
		return () => document.removeEventListener("fullscreenchange", sync);
	}, []);
	const toggle = async () => {
		if (pending.current) return;
		pending.current = true;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			toast.error("无法切换全屏", {
				description: "浏览器未允许本次全屏操作，请再次点击尝试。",
			});
		} finally {
			pending.current = false;
		}
	};
	return (
		<Tooltip disabled={wide}>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size={wide ? "lg" : "icon-workspace"}
						className={cn(
							"workspace-nav-item",
							wide && "w-full justify-start gap-2.5 px-2.5",
						)}
						aria-label={label}
						aria-pressed={fullscreen}
						disabled={!supported}
						disabledReason="当前浏览器不支持全屏"
						onClick={() => void toggle()}
					/>
				}
			>
				<FullscreenIcon state={fullscreen} />
				{wide && (
					<span className="min-w-0 flex-1 truncate text-left">{label}</span>
				)}
			</TooltipTrigger>
			<TooltipContent side="right">{label}</TooltipContent>
		</Tooltip>
	);
}
