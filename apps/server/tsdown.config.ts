/**
 * @file 服务端生产构建配置。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-18
 * 版本作用：当前工作区的开发/运行工具配置。
 * 被调用：对应构建/数据库工具；入口见 package.json。
 * 调用：tsdown。
 * 功能：将启动入口输出为 ESM，打包内部工作区源码及其在 Bun 隔离链接下独有的间接依赖。
 * 预期结果：dist 产物可直接在 apps/server 下由 Bun 启动且无构建警告。
 */
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/init-admin.ts", "./src/funds-worker.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	deps: {
		alwaysBundle: [/@leonwillow-electron\/.*/],
		// Bun 工作区采用隔离依赖链接，packages/auth 与 packages/db 的运行时依赖不挂在 apps/server 下，允许随内联包一起打包。
		onlyBundle: false,
	},
});
