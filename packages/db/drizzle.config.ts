/**
 * @file 数据库工具的连接与迁移配置。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-20
 * 版本作用：服务端数据基础层，随工作区维护。
 * 被调用：对应构建/数据库工具；入口见 package.json。
 * 调用：drizzle-kit、varlock。
 * 功能：加载环境，优先通过直连执行 PostgreSQL schema 和迁移操作。
 * 预期结果：仅数据库命令读取连接信息，不被前端或健康检查引入。
 */
import { defineConfig } from "drizzle-kit";
import "varlock/auto-load";

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: "./src/migrations",
	dialect: "postgresql",
	schemaFilter: ["public"],
	dbCredentials: {
		url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
	},
});
