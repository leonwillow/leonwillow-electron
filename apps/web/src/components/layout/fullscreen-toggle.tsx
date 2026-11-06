/**
 * @file 工作台浏览器全屏开关。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：头像上方提供全屏入口，监听真实浏览器状态以同步 Escape 退出。
 * 被调用：AppSidebar；调用：Fullscreen API、共享 Button/Tooltip、Sonner。
 * 预期结果：用户点击进入/退出全屏；不支持或拒绝时给出中文原因，不持久化全屏状态。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
export default function FullscreenToggle() {
	const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
	const pending = useRef(false);
	const supported = document.fullscreenEnabled;
	const label = fullscreen ? "退出全屏" : "进入全屏";
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
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon-workspace"
						className="relative hover:bg-primary/10 hover:text-primary"
						aria-label={label}
						aria-pressed={fullscreen}
						disabled={!supported}
						disabledReason="当前浏览器不支持全屏"
						onClick={() => void toggle()}
					/>
				}
			>
				{fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
			</TooltipTrigger>
			<TooltipContent side="right">{label}</TooltipContent>
		</Tooltip>
	);
}
