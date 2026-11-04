/**
 * @file Neon 测试环境的服务声明。
 * 创建时间：2026-10-20；修改时间：2026-10-20。
 * 版本作用：声明与 PostgreSQL 分支配套的私有案件原件存储。
 * 被调用：Neon CLI 的 config plan/deploy；调用：@neon/config。
 * 预期结果：显式部署时创建私有桶，应用仍由 Bun/Elysia 运行并管理认证。
 */
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
	buckets: {
		"funds-originals": { access: "private" },
	},
});
