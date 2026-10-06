/**
 * @file 整个测试目录提交至案件 AI 标准化队列。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：与页面相同的入队入口，不预先清洗或选取付款。
 * 被调用：bun src/submit-funds.ts <目录> <管理员用户名> <案件ID>。
 * 调用：数据库、认证工厂、funds enqueueImport。
 * 预期结果：顶层所有支持文件作为一个批次，返回可在页面查看的任务ID。
 */
import "varlock/auto-load";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createAuth } from "@leonwillow-electron/auth";
import { createDatabase } from "@leonwillow-electron/db";
import { user } from "@leonwillow-electron/db/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./env";
import { createFundsFileStore } from "./modules/funds/file-store";
import { enqueueImport } from "./modules/funds/jobs";
import type { Actor } from "./modules/funds/service";
import { initializeServerResources } from "./server-resources";

const [directory, username, caseId] = process.argv.slice(2);
if (!directory || !username || !caseId)
	throw new Error(
		"用法：bun src/submit-funds.ts <目录> <管理员用户名> <案件ID>",
	);
const { db, pool } = createDatabase(ENV.DATABASE_URL);
const fundsFiles = createFundsFileStore(ENV);
const origins = ENV.CORS_ORIGIN.split(",");
const auth = createAuth({
	db,
	secret: ENV.BETTER_AUTH_SECRET,
	baseURL: ENV.BETTER_AUTH_URL,
	trustedOrigins: origins,
});
const release = initializeServerResources({
	fundsFiles,
	db,
	auth,
	origins,
	trustedProxyIps: [],
});
try {
	const [owner] = await db
		.select()
		.from(user)
		.where(eq(user.username, username));
	if (owner?.role !== "admin" || owner.banned)
		throw new Error("需要现有且未停用的管理员。");
	const files = await Promise.all(
		(await readdir(directory))
			.filter((name) => /\.(xlsx|xls|csv|tsv)$/i.test(name))
			.sort()
			.map(async (name) => ({
				name,
				bytes: new Uint8Array(
					await Bun.file(join(directory, name)).arrayBuffer(),
				),
			})),
	);
	console.info(
		JSON.stringify(
			await enqueueImport({ user: owner } as Actor, caseId, files, "ai"),
		),
	);
} finally {
	release();
	fundsFiles.close();
	await pool.end();
}
