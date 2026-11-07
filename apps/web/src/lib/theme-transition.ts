/**
 * @file 手动明暗切换的页面快照过渡。
 * 创建时间：2026-11-06
 * 修改时间：2026-11-06
 * 版本作用：沿用 Arc ThemeSwitch 的 View Transition 接入方式，复用现有主题状态。
 * 被调用：components/layout/mode-toggle、theme-effects。
 * 调用：浏览器 View Transition / matchMedia、react-dom。
 * 功能：从左向右渐变揭示新主题，快速反向时以最后一次操作为准。
 * 预期结果：不重新挂载页面；不支持动画或减少动态效果时仍能正常切换。
 */
import { flushSync } from "react-dom";

type ThemeMode = "light" | "dark";
type ThemeChange = {
	mode: ThemeMode;
	transition?: ViewTransition;
};

// 一张文档只运行一次主题过渡，按钮与 D 快捷键共享尚未绘制的目标模式。
let activeChange: ThemeChange | null = null;

/**
 * 切换当前解析模式；commit 必须同步提交偏好和 next-themes 状态。
 * 新快照捕获前刷新 React 更新；过渡被跳过或启动失败时不丢失主题选择。
 * 只有本次操作可清理标记，旧回调不能覆盖后来的切换。
 */
export function toggleThemeTransition(
	currentMode: ThemeMode,
	commit: (mode: ThemeMode) => void,
) {
	const mode =
		(activeChange?.mode ?? currentMode) === "dark" ? "light" : "dark";
	activeChange?.transition?.skipTransition();
	const change: ThemeChange = { mode };
	activeChange = change;
	const root = document.documentElement;
	let committed = false;
	const apply = () => {
		if (activeChange !== change || committed) return;
		committed = true;
		flushSync(() => commit(mode));
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
		apply();
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
		apply();
		finish();
	}
}
