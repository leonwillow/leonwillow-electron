/**
 * @file 数据库工作区的连接工厂出口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：服务端数据基础层，随工作区维护。
 * 被调用：scripts/architecture.test.ts、packages/auth/src/index.ts、packages/auth/src/bootstrap.ts、apps/server/test/auth.test.ts、apps/server/src/index.ts。
 * 调用：drizzle-orm、pg、./schema。
 * 功能：创建 PostgreSQL Pool 和带关系定义的 Drizzle 客户端。
 * 预期结果：调用方持有并关闭连接池，导入包不会读取环境。
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { authRelations } from "./schema";

/**
 * 创建由调用方管理生命周期的 PostgreSQL 连接池和 Drizzle 客户端。
 * @param connectionString PostgreSQL 连接串；不在这里读取环境变量。
 * @returns db 用于查询，pool 用于关闭连接；不自动迁移表结构。
 */
export function createDatabase(connectionString: string) {
	const pool = new Pool({ connectionString });
	const db = drizzle({ client: pool, relations: authRelations });
	return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
