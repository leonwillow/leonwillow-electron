/**
 * @file 服务端生产构建配置。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前工作区的开发/运行工具配置。
 * 被调用：对应构建/数据库工具；入口见 package.json。
 * 调用：tsdown。
 * 功能：将启动入口输出为 ESM，并打包内部工作区依赖。
 * 预期结果：dist 包含可由 Bun 启动的服务端产物。
 */
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	deps: {
		alwaysBundle: [/@leonwillow-electron\/.*/],
	},
});
