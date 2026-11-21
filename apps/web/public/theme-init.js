/**
 * @file 首屏 React 挂载前的同步明暗与缩放预初始化脚本。
 * 创建时间：2026-11-20；修改时间：2026-11-20。
 * 版本作用：在 HTML 解析阶段同步恢复暗色类、color-scheme 与界面缩放属性，减少冷启动白闪。
 * 被调用：apps/web/index.html。
 * 调用：localStorage、window.matchMedia、document.documentElement。
 * 预期结果：外部脚本符合无 'unsafe-inline' 的 CSP 约定，存储不可用或损坏时静默回退。
 */
(() => {
	try {
		const root = document.documentElement;
		const raw = localStorage.getItem("aidesk-theme-settings");
		const stored = raw ? JSON.parse(raw) : null;
		const mode = stored && typeof stored === "object" ? stored.mode : "system";
		const dark =
			mode === "dark" ||
			(mode !== "light" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches);
		root.classList.toggle("dark", dark);
		root.style.colorScheme = dark ? "dark" : "light";
		let scale = stored && typeof stored === "object" ? stored.scale : undefined;
		if (
			stored &&
			typeof stored === "object" &&
			stored.version !== 2 &&
			scale === "lg"
		) {
			scale = "xl";
		}
		if (scale === "sm" || scale === "md" || scale === "lg" || scale === "xl") {
			root.setAttribute("data-theme-scale", scale);
		}
	} catch {
		// 存储被禁用或 JSON 损坏时保留默认亮色，后续由 main.tsx 接管回退。
	}
})();
