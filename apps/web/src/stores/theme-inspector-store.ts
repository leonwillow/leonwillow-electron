/**
 * @file 管理员专属主题分析悬浮球与面板的两级开关状态。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：在不把主题分析实现打包进首屏的前提下，协调悬浮球启用态与面板展开/收起态。
 * 被调用：components/layout/use-admin-menu.tsx、components/layout/theme-customizer-panel.tsx、components/layout/command-menu-dialog.tsx、views/admin/showcase/index.tsx、components/theme-inspector/*。
 * 调用：zustand、stores/theme-store。
 * 功能：开启后先在右下角显示悬浮球，点击悬浮球展开分析面板并激活拾取；收起为悬浮球后暂停分析方便切换页面。
 * 预期结果：仅管理员宿主订阅并挂载实际分析器，普通用户零加载、零入口。
 */
import { create } from "zustand";
import { useThemeStore } from "@/stores/theme-store";

type ThemeInspectorState = {
	/** 悬浮球是否已开启显示。 */
	enabled: boolean;
	/** 分析面板与页面拾取是否处于展开激活状态。 */
	panelOpen: boolean;
	/** 开启悬浮球（默认收起态，不干扰当前页面切换）。 */
	enable: () => void;
	/** 彻底关闭悬浮球与分析面板。 */
	disable: () => void;
	/** 切换悬浮球开关状态。 */
	toggleEnabled: () => void;
	/** 展开分析面板（同时确保悬浮球已开启并关闭浮动主题编辑器）。 */
	openPanel: () => void;
	/** 收起分析面板回右下角悬浮球（暂停拾取，方便操作和切页）。 */
	closePanel: () => void;
	/** 切换面板展开/收起态。 */
	togglePanel: () => void;
};

export const useThemeInspectorStore = create<ThemeInspectorState>()((set) => ({
	enabled: false,
	panelOpen: false,
	enable: () => set({ enabled: true, panelOpen: false }),
	disable: () => set({ enabled: false, panelOpen: false }),
	toggleEnabled: () =>
		set((state) =>
			state.enabled
				? { enabled: false, panelOpen: false }
				: { enabled: true, panelOpen: false },
		),
	openPanel: () => {
		if (useThemeStore.getState().themeEditorOpen) {
			useThemeStore.getState().setThemeEditorOpen(false);
		}
		set({ enabled: true, panelOpen: true });
	},
	closePanel: () => set({ panelOpen: false }),
	togglePanel: () =>
		set((state) => {
			const nextOpen = !state.panelOpen;
			if (nextOpen && useThemeStore.getState().themeEditorOpen) {
				useThemeStore.getState().setThemeEditorOpen(false);
			}
			return { enabled: true, panelOpen: nextOpen };
		}),
}));
