/**
 * @file 随主题变化的全局通知容器的基础组件。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-07
 * 版本作用：共享 UI 基础层，随工作区维护。
 * 被调用：components/layout/root-layout.tsx。
 * 调用：next-themes、sonner。
 * 功能：组合底层控件和语义样式，透传对应属性并提供稳定 data-slot。
 * 预期结果：业务调用方负责内容与事件，基础层不依赖应用路由或账号接口。
 */
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			containerAriaLabel="通知"
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--success-bg":
						"color-mix(in oklab, var(--success) 10%, var(--popover))",
					"--success-text": "var(--success)",
					"--success-border":
						"color-mix(in oklab, var(--success) 25%, var(--border))",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
