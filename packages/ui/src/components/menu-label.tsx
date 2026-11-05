/**
 * @file 菜单行名称的渐隐和悬停滚动展示。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：共享菜单文字展示层，替代省略号和全文 Tooltip。
 * 被调用：工作台二级菜单；调用：ResizeObserver、React 和共享样式。
 * 功能：测量实际溢出距离，行悬停/键盘聚焦时滚动至末尾；减少动态效果时允许手动滚动。
 * 预期结果：文本变化、面板缩放和字体变化后重新测量，不改变操作按钮的位置。
 */
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export function MenuLabel({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	const viewportRef = useRef<HTMLSpanElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const [distance, setDistance] = useState(0);
	useLayoutEffect(() => {
		const viewport = viewportRef.current;
		const text = textRef.current;
		if (!viewport || !text) return;
		const measure = () =>
			setDistance(Math.max(0, text.scrollWidth - viewport.clientWidth));
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(text);
		measure();
		return () => observer.disconnect();
	}, []);
	return (
		<span
			ref={viewportRef}
			data-slot="menu-label"
			data-overflow={distance > 1 || undefined}
			className={cn("menu-label", className)}
			style={
				{
					"--menu-label-travel": `${-distance}px`,
					"--menu-label-duration": `${Math.max(4, distance / 35 + 3)}s`,
				} as CSSProperties
			}
		>
			<span ref={textRef} className="menu-label-text">
				{children}
			</span>
		</span>
	);
}
