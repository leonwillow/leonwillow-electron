/**
 * @file 跨路由存活的应用根布局。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：routes/__root.tsx。
 * 调用：ui 基础组件/样式、@tanstack/react-router、react、next-themes、stores/theme-store、components/layout/theme-effects、components/theme-editor/theme-editor。
 * 功能：装配主题 Provider、页面出口、延迟加载的编辑器和全局提示。
 * 预期结果：路由跳转不重建编辑草稿，关闭编辑器后卸载其内容。
 */
import { Toaster } from "@leonwillow-electron/ui/components/sonner";
import { Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { useThemeStore } from "@/stores/theme-store";
import ThemeEffects from "./theme-effects";

const ThemeEditor = lazy(
	() => import("@/components/theme-editor/theme-editor"),
);

// 打开时才加载编辑器；宿主不属于 Outlet，切换工作台或认证页面不会重建草稿。
function ThemeEditorHost() {
	const themeEditorOpen = useThemeStore((state) => state.themeEditorOpen);
	return themeEditorOpen ? (
		<Suspense fallback={null}>
			<ThemeEditor />
		</Suspense>
	) : null;
}

export default function RootLayout() {
	const previewMode = useThemeStore((state) => state.preview?.mode);
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme={useThemeStore.getInitialState().preferences.settings.mode}
			// 临时明暗预览不写入 next-themes 的存储，否则会影响其他窗口。
			forcedTheme={previewMode}
			enableSystem
			disableTransitionOnChange
			// CSR 首屏初始化已在 main.tsx 执行；用原库公开属性保留惰性脚本。
			scriptProps={{ type: "text/plain" }}
		>
			<ThemeEffects />
			<Outlet />
			<ThemeEditorHost />
			<Toaster {...(previewMode ? { theme: previewMode } : {})} />
		</ThemeProvider>
	);
}
