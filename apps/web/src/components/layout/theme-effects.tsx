/**
 * @file 共享主题状态与浏览器显示之间的生命周期连接。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-06
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/root-layout.tsx。
 * 调用：react、next-themes、stores/theme-store、utils/theme-script、lib/theme-transition。
 * 功能：应用 CSS 变量、解析明暗模式，挂载快捷键和跨窗口同步。
 * 预期结果：预览即时生效，根布局卸载后不遗留全局监听。
 */
import { useTheme } from "next-themes";
import { useEffect, useEffectEvent } from "react";
import { toggleThemeTransition } from "@/lib/theme-transition";
import { connectThemeSync, useThemeStore } from "@/stores/theme-store";
import { applyTheme } from "@/utils/theme-script";

// 输入和可编辑区域保留字母键的原生用途。
const isTypingTarget = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable ||
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT");

export default function ThemeEffects() {
	const preferences = useThemeStore((state) => state.preferences);
	const preview = useThemeStore((state) => state.preview);
	const { setTheme, resolvedTheme } = useTheme();

	useEffect(connectThemeSync, []);
	useEffect(() => {
		setTheme(preferences.settings.mode);
	}, [preferences.settings.mode, setTheme]);
	useEffect(() => {
		applyTheme(
			preferences,
			preview?.mode ?? (resolvedTheme === "dark" ? "dark" : "light"),
			preview?.draft,
		);
	}, [preferences, preview, resolvedTheme]);

	const toggleMode = useEffectEvent(() => {
		const { preview, updateSettings } = useThemeStore.getState();
		// 编辑时由面板控制预览，快捷键不改动草稿背后的持久化偏好。
		if (preview) return;
		toggleThemeTransition(
			resolvedTheme === "dark" ? "dark" : "light",
			(mode) => {
				updateSettings({ mode });
				setTheme(mode);
			},
		);
	});
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.repeat ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				event.key?.toLowerCase() !== "d" ||
				isTypingTarget(event.target)
			)
				return;
			toggleMode();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return null;
}
