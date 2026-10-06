/**
 * @file 本地测试案件的完整目录导入入口。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：运维离线入口，复用与 HTTP 上传一致的清洗/存储/投影管线。
 * 被调用：bun src/import-funds.ts <目录> <管理员用户名> [案件 ID]。
 * 调用：Varlock、认证/数据库工厂和 funds 服务。
 * 功能：导入目录顶层全部受支持文件；不选择预设付款，不递归混入辅助文件。
 * 预期结果：没有真实管理员时拒绝执行，不创建账户；打印整案导入报告。
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
import { createFundsGraph } from "./modules/funds/graph";
import {
	analysisSummary,
	caseDetails,
	createCase,
	importStatements,
} from "./modules/funds/service";
import { initializeServerResources } from "./server-resources";

const [directory, username, existingCaseId] = process.argv.slice(2);
if (!directory || !username)
	throw new Error(
		"用法：bun src/import-funds.ts <目录> <管理员用户名> [案件 ID]",
	);
const { db, pool } = createDatabase(ENV.DATABASE_URL);
const fundsFiles = createFundsFileStore(ENV);
const fundsGraph = createFundsGraph(
	ENV.NEO4J_URI,
	ENV.NEO4J_USER,
	ENV.NEO4J_PASSWORD,
);
let release: (() => void) | undefined;
try {
	const [owner] = await db
		.select()
		.from(user)
		.where(eq(user.username, username));
	if (owner?.role !== "admin" || owner.banned)
		throw new Error("需要现有且未停用的管理员用户名。");
	const origins = ENV.CORS_ORIGIN.split(",");
	const auth = createAuth({
		db,
		secret: ENV.BETTER_AUTH_SECRET,
		baseURL: ENV.BETTER_AUTH_URL,
		trustedOrigins: origins,
	});
	release = initializeServerResources({
		fundsFiles,
		db,
		auth,
		fundsGraph,
		origins,
		trustedProxyIps: [],
	});
	const actor = {
		user: {
			id: owner.id,
			username,
			name: owner.name,
			image: owner.image,
			role: "admin" as const,
		},
	};
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
	const caseId =
		existingCaseId ?? (await createCase(actor, "银行流水测试案件")).id;
	const result = await importStatements(actor, caseId, files);
	const details = await caseDetails(actor, caseId);
	const summary = result.graphReady
		? await analysisSummary(actor, caseId)
		: null;
	console.info(
		JSON.stringify(
			{ caseId, ...result, totals: details.totals, summary },
			null,
			2,
		),
	);
} finally {
	release?.();
	fundsFiles.close();
	await Promise.all([pool.end(), fundsGraph.close()]);
}
