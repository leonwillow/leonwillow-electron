/**
 * @file 管理员专属主题分析悬浮球的权限边界与懒加载宿主。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：严格将主题分析能力限制在管理员会话内，未启用或非管理员时零加载实际代码。
 * 被调用：components/layout/workspace-layout.tsx。
 * 调用：react、@tanstack/react-router、stores/theme-inspector-store、stores/theme-store、./theme-inspector（懒加载）。
 * 功能：校验用户 role === "admin"；打开浮动主题编辑器时自动收起分析面板避免预览冲突。
 * 预期结果：普通成员无法触发或加载主题分析工具，管理员开启后右下角挂载悬浮球且不占工作区空间。
 */
import { getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useThemeInspectorStore } from "@/stores/theme-inspector-store";
import { useThemeStore } from "@/stores/theme-store";

const ThemeInspector = lazy(() => import("./theme-inspector"));

export default function ThemeInspectorHost() {
	const role = getRouteApi("/_workspace").useRouteContext({
		select: ({ user }) => user.role,
	});
	const isAdmin = role === "admin";
	const enabled = useThemeInspectorStore((state) => state.enabled);
	const panelOpen = useThemeInspectorStore((state) => state.panelOpen);
	const disable = useThemeInspectorStore((state) => state.disable);
	const closePanel = useThemeInspectorStore((state) => state.closePanel);
	const themeEditorOpen = useThemeStore((state) => state.themeEditorOpen);

	useEffect(() => {
		if (!isAdmin && enabled) disable();
	}, [isAdmin, enabled, disable]);

	useEffect(() => {
		if (themeEditorOpen && panelOpen) closePanel();
	}, [themeEditorOpen, panelOpen, closePanel]);

	if (!isAdmin || !enabled) return null;

	return (
		<Suspense fallback={null}>
			<ThemeInspector />
		</Suspense>
	);
}
