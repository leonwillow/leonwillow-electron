/**
 * @file Bun 服务进程的启动入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-10
 * 版本作用：Bun 服务进程的唯一启动入口。
 * 被调用：server 的 dev/start 命令。
 * 调用：Varlock、auth/db 工厂、app、env、lifecycle、server-resources、auth/client-ip。
 * 功能：装配认证与监听；管理启动失败、终止信号与连接池关闭。
 * 预期结果：普通启动不创建管理员，停止时先排空请求再释放数据库。
 */
import "varlock/auto-load";
import { createAuth } from "@leonwillow-electron/auth";
import { createDatabase } from "@leonwillow-electron/db";
import { createApp } from "./app";
import { createOriginResolver } from "./auth-origins";
import { ENV } from "./env";
import { createShutdown } from "./lifecycle";
import { parseTrustedProxyIps } from "./modules/auth/client-ip";
import { createFundsFileStore } from "./modules/funds/file-store";
import { createFundsGraph } from "./modules/funds/graph";
import { initializeServerResources } from "./server-resources";

const trustedProxyIps = parseTrustedProxyIps(ENV.TRUSTED_PROXY_IPS);
const { db, pool } = createDatabase(ENV.DATABASE_URL);
const fundsFiles = createFundsFileStore(ENV);
const fundsGraph = createFundsGraph(
	ENV.NEO4J_URI,
	ENV.NEO4J_USER,
	ENV.NEO4J_PASSWORD,
);
const origins = createOriginResolver(ENV.CORS_ORIGIN.split(","), ENV.NODE_ENV);
let releaseResources: (() => void) | undefined;
try {
	const auth = createAuth({
		db,
		secret: ENV.BETTER_AUTH_SECRET,
		baseURL: ENV.BETTER_AUTH_URL,
		trustedOrigins: origins,
	});
	releaseResources = initializeServerResources({
		fundsFiles,
		auth,
		db,
		origins,
		trustedProxyIps,
		fundsGraph,
	});
	const app = createApp().listen({
		port: ENV.PORT,
		hostname: ENV.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
	});
	const server = app.server;
	if (!server) throw new Error("API 未建立监听。");
	const shutdown = createShutdown({
		stop: (force) => server.stop(force),
		close: async () => {
			releaseResources?.();
			fundsFiles.close();
			await Promise.all([pool.end(), fundsGraph.close()]);
		},
	});
	const onSignal = () => {
		void shutdown().then(
			() => process.exit(0),
			() => {
				console.error("API 未能在期限内正常关闭，进程将退出。");
				process.exit(1);
			},
		);
	};
	process.on("SIGTERM", onSignal);
	process.on("SIGINT", onSignal);
	console.info("API 已启动，端口：", server.port);
} catch (error) {
	releaseResources?.();
	fundsFiles.close();
	await Promise.all([pool.end(), fundsGraph.close()]);
	throw error;
}
