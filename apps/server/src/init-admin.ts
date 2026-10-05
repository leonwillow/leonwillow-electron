/**
 * @file 受控管理员初始化命令。
 * 创建时间：2026-10-04（本次新建）
 * 修改时间：2026-10-04
 * 版本作用：将账号引导从常规启动路径分离。
 * 被调用：bun run auth:init；调用：Varlock、auth/bootstrap、数据库工厂。
 * 功能：要求显式密码，仅创建缺失管理员，结束时关闭连接池。
 * 预期结果：不监听端口、不输出密码、不重置已有账号。
 */
import "varlock/auto-load";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import { ENV } from "./env";

const password = ENV.ADMIN_INITIAL_PASSWORD;
if (!password || password.length < 8 || password.length > 128)
	throw new Error(
		"请通过 ADMIN_INITIAL_PASSWORD 注入 8～128 位初始密码后执行 auth:init。",
	);
const { db, pool } = createDatabase(ENV.DATABASE_URL);
try {
	const auth = createAuth({
		db,
		secret: ENV.BETTER_AUTH_SECRET,
		baseURL: ENV.BETTER_AUTH_URL,
		trustedOrigins: ENV.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
	});
	console.info(
		(await initializeAdmin(auth, db, password))
			? "管理员已创建。"
			: "管理员已存在，密码和角色未修改。",
	);
} finally {
	await pool.end();
}
