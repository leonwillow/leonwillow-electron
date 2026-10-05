/**
 * @file 浏览器应用的唯一启动入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：apps/web/index.html。
 * 调用：@tanstack/react-router、react、react-dom、stores/theme-store、routeTree.gen、utils/theme-script、ui 基础组件/样式、styles/fonts.css。
 * 功能：首屏应用主题，创建 TanStack Router 并挂载 React。
 * 预期结果：Web 使用浏览器路由，file 协议使用 hash 路由；共享同一套视图。
 */
import {
	createHashHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "@/routeTree.gen";
import { useThemeStore } from "@/stores/theme-store";
import { initializeTheme } from "@/utils/theme-script";
import "@leonwillow-electron/ui/globals.css";
import "@/styles/fonts.css";

initializeTheme(useThemeStore.getState().preferences);

const router = createRouter({
	routeTree,
	basepath:
		window.location.protocol === "file:" ? "/" : import.meta.env.BASE_URL,
	defaultPreload: "intent",
	scrollRestoration: true,
	// Electron 使用 file:// 加载同一份构建时，路由无需服务器回退。
	history:
		window.location.protocol === "file:" ? createHashHistory() : undefined,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const element = document.getElementById("app");
if (!element) throw new Error("缺少应用挂载节点 #app");
createRoot(element).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
