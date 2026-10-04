/**
 * @file Bun 服务进程的启动入口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Bun 服务进程的唯一启动入口。
 * 被调用：server 的 dev/start 命令。
 * 调用：varlock、@leonwillow-electron/auth、@leonwillow-electron/db、./app、./env。
 * 功能：加载环境，创建数据库与认证实例，初始化管理员后监听。
 * 预期结果：启动失败明确抛错，只有完成初始化才开始接收请求。
 */
import "varlock/auto-load";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeDefaultAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import { createApp } from "./app";
import { ENV } from "./env";

const { db } = createDatabase(ENV.DATABASE_URL);
const origins = ENV.CORS_ORIGIN.split(",").map((origin) => origin.trim());
const auth = createAuth({
	db,
	secret: ENV.BETTER_AUTH_SECRET,
	baseURL: ENV.BETTER_AUTH_URL,
	trustedOrigins: origins,
});
if (await initializeDefaultAdmin(auth, db))
	console.info("默认管理员已初始化。");
const app = createApp(origins, auth).listen({
	port: ENV.PORT,
	hostname: ENV.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
});
console.info("API 已启动，端口：", app.server?.port);
