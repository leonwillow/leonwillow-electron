/**
 * @file 独立银行流水后台计算进程。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：由 Bun 运行持久队列，HTTP 服务退出不影响已保存任务。
 * 被调用：worker/start:worker 脚本；调用：资源工厂与 funds jobs。
 * 预期结果：失败任务可重试；退出时中止网络操作并释放连接。
 */
import "varlock/auto-load";
import { createAuth } from "@leonwillow-electron/auth";
import { createDatabase } from "@leonwillow-electron/db";
import { ENV } from "./env";
import { createFundsFileStore } from "./modules/funds/file-store";
import { createFundsGraph } from "./modules/funds/graph";
import { processNextFundsJob } from "./modules/funds/jobs";
import { initializeServerResources } from "./server-resources";

const { db, pool } = createDatabase(ENV.DATABASE_URL);
const fundsFiles = createFundsFileStore(ENV);
const fundsGraph = createFundsGraph(
	ENV.NEO4J_URI,
	ENV.NEO4J_USER,
	ENV.NEO4J_PASSWORD,
);
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
	fundsGraph,
	origins,
	trustedProxyIps: [],
});
const controller = new AbortController();
const owner = crypto.randomUUID();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());
console.info("流水 worker 已启动，等待案件任务。");
try {
	while (!controller.signal.aborted) {
		try {
			const handled = await processNextFundsJob(
				{
					baseUrl: ENV.FUNDS_AI_BASE_URL,
					apiKey: ENV.FUNDS_AI_API_KEY ?? "",
					model: ENV.FUNDS_AI_MODEL,
				},
				{ owner, signal: controller.signal },
			);
			if (!handled) await Bun.sleep(1000);
		} catch (error) {
			console.error(
				"流水 worker 暂时无法领取任务：",
				error instanceof Error ? error.message : "数据库不可用",
			);
			await Bun.sleep(3000);
		}
	}
} finally {
	release();
	fundsFiles.close();
	await Promise.all([pool.end(), fundsGraph.close()]);
}
