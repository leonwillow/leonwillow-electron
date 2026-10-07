/**
 * @file 工具栏与其 Portal 弹层的停靠协作上下文。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：弹层打开期间阻止悬停工具栏自动收起。
 * 被调用：GraphCanvas、GraphToolbar、GraphToolbarSettings。
 * 功能：提供向画布内侧展开的方向与弹层占用通知。
 * 预期结果：鼠标进入筛选或设置后，触发按钮仍然可见。
 */
import { createContext } from "react";

export const GraphToolbarContext = createContext<{
	side: "top" | "bottom" | "left" | "right";
	onPopupChange: (key: string, open: boolean) => void;
}>({ side: "top", onPopupChange: () => {} });
