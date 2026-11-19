/**
 * @file 手动明暗切换的页面快照过渡。
 * 创建时间：2026-11-06
 * 修改时间：2026-11-19
 * 版本作用：沿用 Arc ThemeSwitch 的 View Transition 接入方式，复用现有主题状态。
 * 被调用：components/layout/mode-toggle、theme-customizer-panel、theme-effects。
 * 调用：浏览器 View Transition / matchMedia、react-dom、types/theme。
 * 功能：按解析后的目标明暗从左向右渐变揭示新主题，快速反向时以最后一次操作为准。
 * 预期结果：不重新挂载页面；解析结果未变、不支持动画或减少动态效果时直接提交且不空放过渡。
 */
import { flushSync } from "react-dom";
import type { Mode } from "@/types/theme";

type ThemeMode = "light" | "dark";
type ThemeChange = {
	mode: ThemeMode;
	transition?: ViewTransition;
};

// 一张文档只运行一次主题过渡，侧栏按钮、主题设置与 D 快捷键共享尚未绘制的目标模式。
let activeChange: ThemeChange | null = null;

/**
 * 将包含 system 的主题偏好解析为当前实际明暗。
 * @param mode 目标主题模式（light / dark / system）。
 * @param systemTheme next-themes 解析出的系统明暗，缺省时回退媒体查询。
 * @returns 实际显示的浅色或深色模式。
 */
export function resolveThemeMode(mode: Mode, systemTheme?: string): ThemeMode {
	if (mode === "light" || mode === "dark") return mode;
	if (systemTheme === "light" || systemTheme === "dark") return systemTheme;
	return typeof window !== "undefined" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

/**
 * 按目标解析明暗执行一次页面快照过渡；commit 必须同步提交偏好和 next-themes 状态。
 * 解析明暗未变、浏览器不支持、系统减少动态效果或页面隐藏时直接提交，不播放空过渡。
 * 新快照捕获前刷新 React 更新；过渡被跳过或启动失败时不丢失主题选择。
 * 只有本次操作可清理标记，旧回调不能覆盖后来的切换。
 */
export function runThemeTransition(
	currentMode: ThemeMode,
	nextMode: ThemeMode,
	commit: () => void,
) {
	const previousMode = activeChange?.mode ?? currentMode;
	activeChange?.transition?.skipTransition();
	const root = document.documentElement;
	if (previousMode === nextMode) {
		activeChange = null;
		root.removeAttribute("data-theme-transition");
		commit();
		return;
	}
	const change: ThemeChange = { mode: nextMode };
	activeChange = change;
	let committed = false;
	const apply = () => {
		if (activeChange !== change || committed) return;
		committed = true;
		flushSync(commit);
	};
	const finish = () => {
		if (activeChange !== change) return;
		activeChange = null;
		root.removeAttribute("data-theme-transition");
	};
	if (
		typeof document.startViewTransition !== "function" ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		document.visibilityState === "hidden"
	) {
		committed = true;
		commit();
		finish();
		return;
	}

	root.setAttribute("data-theme-transition", "sweep");
	try {
		const transition = document.startViewTransition(apply);
		change.transition = transition;
		// 中途反向和浏览器跳过快照都会拒绝 ready，但仍会执行更新回调。
		void transition.ready.catch(() => {});
		void transition.finished.then(finish, () => {
			apply();
			finish();
		});
	} catch {
		committed = true;
		commit();
		finish();
	}
}

/**
 * 切换当前解析模式；commit 必须同步提交偏好和 next-themes 状态。
 */
export function toggleThemeTransition(
	currentMode: ThemeMode,
	commit: (mode: ThemeMode) => void,
) {
	const mode =
		(activeChange?.mode ?? currentMode) === "dark" ? "light" : "dark";
	runThemeTransition(currentMode, mode, () => commit(mode));
}
