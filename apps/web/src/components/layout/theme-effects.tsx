/**
 * @file 共享主题状态与浏览器显示之间的生命周期连接。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-21
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/root-layout.tsx。
 * 调用：react、next-themes、stores/theme-store、lib/theme-script。
 * 功能：应用 CSS 变量、解析明暗模式并挂载跨窗口同步（不再绑定单键切换明暗快捷键）。
 * 预期结果：预览即时生效，根布局卸载后不遗留全局监听。
 */
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { applyTheme } from "@/lib/theme-script";
import { connectThemeSync, useThemeStore } from "@/stores/theme-store";

export default function ThemeEffects() {
	const preferences = useThemeStore((state) => state.preferences);
	const preview = useThemeStore((state) => state.preview);
	const { setTheme, resolvedTheme } = useTheme();

	useEffect(connectThemeSync, []);
	useEffect(() => {
		setTheme(preferences.settings.mode);
	}, [preferences.settings.mode, setTheme]);
	useEffect(() => {
		const activeMode =
			preview?.mode ??
			(resolvedTheme === "dark" || resolvedTheme === "light"
				? resolvedTheme
				: preferences.settings.mode === "dark" ||
						(preferences.settings.mode === "system" &&
							window.matchMedia("(prefers-color-scheme: dark)").matches)
					? "dark"
					: "light");
		applyTheme(preferences, activeMode, preview?.draft);
	}, [preferences, preview, resolvedTheme]);

	return null;
}
