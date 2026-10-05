/**
 * @file Web 开发服务器与 CSR 构建配置。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前工作区的开发/运行工具配置。
 * 被调用：对应构建/数据库工具；入口见 package.json。
 * 调用：@tailwindcss/vite、@tanstack/router-plugin、@varlock/vite-integration、@vitejs/plugin-react、vite。
 * 功能：组合环境、Tailwind、文件路由生成和 React 插件。
 * 预期结果：生成静态客户端产物，开发端口默认 3001。
 */
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/",
	server: {
		port: 3001,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		varlockVitePlugin(),
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
