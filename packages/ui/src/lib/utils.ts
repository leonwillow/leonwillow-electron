/**
 * @file 基础组件的类名合并入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-06
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：packages/ui/test、components、components/layout。
 * 调用：clsx、tailwind-merge。
 * 功能：先展开条件类名，再按共享令牌合并 Tailwind 冲突。
 * 预期结果：控件高度、文字令牌和颜色不会被错误互相覆盖。
 */
import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 注册共享令牌，避免 text-control 被误判为文字颜色而覆盖 text-primary。
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["control", "caption"],
			spacing: [
				"control-xs",
				"control-sm",
				"control-md",
				"control-lg",
				"workspace-header",
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
