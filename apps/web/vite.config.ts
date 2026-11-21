/**
 * @file Web 开发服务器与 CSR 构建配置。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：当前工作区的开发/运行工具配置。
 * 被调用：对应构建/数据库工具；入口见 package.json。
 * 调用：@tailwindcss/vite、@tanstack/router-plugin、@varlock/vite-integration、@vitejs/plugin-react、vite。
 * 功能：组合构建插件并配置 Rolldown 分包合并策略；开发时通过同源 /api 代理支持局域网访问。
 * 预期结果：生成静态客户端产物，消除大量碎片小 chunk，开发入口固定 3001，API 目标来自公开环境配置。
 */
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
	base: "/",
	server: {
		host: "0.0.0.0",
		port: 3001,
		strictPort: true,
		proxy: {
			"/api": {
				target:
					loadEnv(mode, import.meta.dirname, "VITE_").VITE_SERVER_URL ||
					"http://127.0.0.1:3000",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					minSize: 16_000,
					groups: [
						{
							name: "vendor-react",
							test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
							priority: 40,
						},
						{
							name: "vendor-router",
							test: /[\\/]node_modules[\\/]@tanstack[\\/](react-router|router-core|history)[\\/]/,
							priority: 30,
						},
						{
							name: "vendor-ui",
							test: /[\\/]node_modules[\\/](@base-ui|class-variance-authority|clsx|tailwind-merge|sonner)[\\/]/,
							priority: 25,
						},
						{
							name: "shared-ui",
							test: /[\\/]packages[\\/]ui[\\/]src[\\/]/,
							minShareCount: 2,
							priority: 20,
						},
						{
							name: "vendor-icons",
							test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
							minShareCount: 2,
							priority: 15,
						},
						{
							name: "vendor-common",
							test: /[\\/]node_modules[\\/]/,
							minShareCount: 2,
							minSize: 12_000,
							priority: 5,
						},
					],
				},
			},
		},
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
}));
