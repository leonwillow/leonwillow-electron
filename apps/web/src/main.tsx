import {
	createHashHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { savedSettings } from "@/lib/theme-settings";
import { routeTree } from "@/routeTree.gen";
import { initializeTheme } from "@/utils/theme-script";
import "@leonwillow-electron/ui/globals.css";
import "@/styles/fonts.css";

initializeTheme(savedSettings);

const router = createRouter({
	routeTree,
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
