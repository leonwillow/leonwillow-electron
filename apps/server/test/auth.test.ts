/**
 * @file 账号认证全链路的数据库集成测试。
 * 创建时间：2026-10-04（Git 首次收录）
 * 修改时间：2026-10-05
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、@elysiajs/eden、@leonwillow-electron/auth、@leonwillow-electron/db、drizzle-orm、../src/app。
 * 功能：每个用例在随机独立 schema 中执行迁移、初始化、登录注册、退出与限流。
 * 预期结果：使用真实密码哈希和会话；清理仅作用于本次测试 schema。
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import { account, session, user } from "@leonwillow-electron/db/schema";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { type App, createApp } from "../src/app";
import { initializeServerResources } from "../src/server-resources";

// 在同一 PostgreSQL 中创建独立 schema；只清理本次测试生成的 schema。
describe("真实账号密码认证", () => {
	let schemaName = "";
	let database: ReturnType<typeof createDatabase>;
	let app: App;
	let auth: ReturnType<typeof createAuth>;
	let api: ReturnType<typeof treaty<App>>;
	let releaseResources: (() => void) | undefined;
	const origin = "http://localhost:3002";
	const password = "test pass word 8";

	beforeEach(async () => {
		schemaName = `auth_test_${crypto.randomUUID().replaceAll("-", "")}`;
		const url = new URL(process.env.DATABASE_URL ?? "");
		url.searchParams.set("options", `-c search_path=${schemaName}`);
		database = createDatabase(url.toString());
		await database.pool.query(`CREATE SCHEMA "${schemaName}"`);
		await migrate(database.db, {
			migrationsFolder: new URL(
				"../../../packages/db/src/migrations",
				import.meta.url,
			).pathname,
			migrationsSchema: schemaName,
		});
		auth = createAuth({
			db: database.db,
			secret: crypto.randomUUID() + crypto.randomUUID(),
			baseURL: "http://localhost:3000",
			trustedOrigins: [origin],
		});
		releaseResources = initializeServerResources({
			auth,
			db: database.db,
			origins: [origin],
			trustedProxyIps: [],
		});
		app = createApp().listen({
			port: 0,
			hostname: "127.0.0.1",
		});
		api = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
			headers: { origin },
		});
	});

	afterEach(async () => {
		try {
			await app?.stop();
		} finally {
			releaseResources?.();
			releaseResources = undefined;
			if (database) {
				try {
					await database.pool.query(
						`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
					);
				} finally {
					await database.pool.end();
				}
			}
		}
	});

	/** 每个会话场景自行准备账号，不读取其他测试产生的 Cookie。 */
	async function registerFixture() {
		await auth.api.createUser({
			body: {
				email: "test_user@leonwillow.com",
				name: "测试人员",
				password,
				role: "user",
				data: { username: "test_user", displayUsername: "Test_User" },
			},
		});
		const result = await api.api.auth.login.post({
			username: "Test_User",
			password,
			rememberMe: false,
		});
		expect(result.status).toBe(200);
		return {
			userId: result.data?.user.id ?? "",
			cookie: result.response.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; "),
		};
	}

	test("服务运行中拒绝替换共享资源，原会话和来源限制继续生效", async () => {
		const { cookie, userId } = await registerFixture();
		expect(() =>
			initializeServerResources({
				auth,
				db: database.db,
				origins: ["https://untrusted.invalid"],
				trustedProxyIps: ["127.0.0.1"],
			}),
		).toThrow("服务资源已初始化");
		const result = await api.api.auth.session.get({ headers: { cookie } });
		expect(result.status).toBe(200);
		expect(result.data?.user.id).toBe(userId);
		expect(result.response.headers.get("access-control-allow-origin")).toBe(
			origin,
		);
		const denied = await api.api.auth.logout.post(undefined, {
			headers: { cookie, origin: "https://untrusted.invalid" },
		});
		expect(denied.status).toBe(403);
		expect(
			denied.response.headers.get("access-control-allow-origin"),
		).toBeNull();
		expect(denied.error?.value).toMatchObject({ code: "INVALID_ORIGIN" });
		expect(
			(await api.api.auth.session.get({ headers: { cookie } })).status,
		).toBe(200);
	});

	test("普通启动不创建管理员，弱初始密码被拒绝", async () => {
		expect(await database.db.select().from(user)).toEqual([]);
		await expect(initializeAdmin(auth, database.db, "admin")).rejects.toThrow(
			"8～128",
		);
		expect(await database.db.select().from(user)).toEqual([]);
	});

	test("初始化不会把已有普通 admin 账号自动提权", async () => {
		await auth.api.createUser({
			body: {
				email: "admin@leonwillow.com",
				name: "普通账号",
				role: "user",
				data: { username: "admin" },
				password,
			},
		});
		await expect(initializeAdmin(auth, database.db, password)).rejects.toThrow(
			"不会覆盖",
		);
		const [existing] = await database.db
			.select()
			.from(user)
			.where(eq(user.username, "admin"));
		expect(existing?.role).toBe("user");
	});

	test("显式并发初始化管理员，已有密码不会被重复初始化覆盖", async () => {
		const initialized = await Promise.all([
			initializeAdmin(auth, database.db, password),
			initializeAdmin(auth, database.db, password),
		]);
		expect(initialized.filter(Boolean)).toHaveLength(1);
		const [adminUser] = await database.db
			.select()
			.from(user)
			.where(eq(user.username, "admin"));
		expect(adminUser?.role).toBe("admin");
		expect(adminUser?.email).toBe("admin@leonwillow.com");
		const [credential] = await database.db
			.select()
			.from(account)
			.where(eq(account.userId, adminUser?.id ?? ""));
		expect(credential?.password).not.toBe("admin");
		const login = await auth.api.signInUsername({
			body: { username: "admin", password, rememberMe: false },
		});
		expect(login.user).toMatchObject({ id: adminUser?.id, role: "admin" });
		expect(
			await initializeAdmin(auth, database.db, "another secure password"),
		).toBe(false);
		const [retained] = await database.db
			.select()
			.from(account)
			.where(eq(account.id, credential?.id ?? ""));
		expect(retained?.password).toBe(credential?.password);
	});

	test("未登录、非法来源和未确认条款不能取得会话或创建账号", async () => {
		expect((await api.api.auth.session.get()).status).toBe(401);
		const denied = await api.api.auth.register.post(
			{ username: "new_user", password, agreeToTerms: true },
			{ headers: { origin: "https://untrusted.invalid" } },
		);
		expect(denied.status).toBe(403);
		expect(denied.error?.value).toMatchObject({ code: "INVALID_ORIGIN" });
		const invalid = await fetch(
			`http://127.0.0.1:${app.server?.port}/api/auth/register`,
			{
				method: "POST",
				headers: { origin, "content-type": "application/json" },
				body: JSON.stringify({
					username: "new_user",
					password,
					agreeToTerms: false,
				}),
			},
		);
		expect(invalid.status).toBe(422);
		const invalidUsername = await api.api.auth.register.post({
			username: "invalid account",
			password,
			agreeToTerms: true,
		});
		expect(invalidUsername.status).toBe(403);
		expect(invalidUsername.error?.value).toMatchObject({
			code: "REGISTRATION_CLOSED",
		});
	});

	test("管理员创建的账号使用真实密码哈希，登录 Cookie 和公开响应保持边界", async () => {
		await registerFixture();
		const result = await api.api.auth.login.post({
			username: "  Test_User  ",
			password,
			rememberMe: false,
		});
		expect(result.status).toBe(200);
		expect(result.error).toBeNull();
		expect(result.data?.user.username).toBe("Test_User");
		expect(result.data?.user.role).toBe("user");
		const userId = result.data?.user.id ?? "";
		expect(userId).not.toBe("");
		expect(Object.keys(result.data ?? {})).toEqual(["user"]);
		expect(result.data?.user).not.toHaveProperty("email");
		expect(result.data?.user).not.toHaveProperty("password");
		const setCookies = result.response.headers.getSetCookie();
		const sessionCookie = setCookies.find((value) =>
			value.startsWith("leonwillow.session_token="),
		);
		expect(sessionCookie).toContain("HttpOnly");
		expect(sessionCookie).toContain("SameSite=Lax");
		expect(sessionCookie).not.toContain("Max-Age=");

		const [credential] = await database.db
			.select()
			.from(account)
			.where(eq(account.userId, userId));
		expect(credential?.password).not.toBe(password);
		expect(credential?.password?.length).toBeGreaterThan(60);
		expect(credential?.providerId).toBe("credential");
		const [storedUser] = await database.db
			.select()
			.from(user)
			.where(eq(user.id, userId));
		expect(storedUser?.username).toBe("test_user");
		expect(storedUser?.email).toBe("test_user@leonwillow.com");
	});

	test("已签名 Cookie 恢复会话，篡改 Cookie 不能取得用户资料", async () => {
		const { cookie, userId } = await registerFixture();
		const result = await api.api.auth.session.get({ headers: { cookie } });
		expect(result.status).toBe(200);
		expect(result.data?.user.id).toBe(userId);
		const forged = await api.api.auth.session.get({
			headers: { cookie: "leonwillow.session_token=forged" },
		});
		expect(forged.status).toBe(401);
	});

	test("注册已关闭，错误密码不能登录，账号大小写按官方插件处理", async () => {
		const { userId } = await registerFixture();
		const duplicate = await api.api.auth.register.post({
			username: "test_user",
			password,
			agreeToTerms: true,
		});
		expect(duplicate.status).toBe(403);
		expect(duplicate.error?.value).toMatchObject({
			code: "REGISTRATION_CLOSED",
		});
		const denied = await api.api.auth.login.post({
			username: "test_user",
			password: "wrong password",
			rememberMe: false,
		});
		expect(denied.status).toBe(401);
		expect(denied.error?.value).toMatchObject({
			code: "INVALID_USERNAME_OR_PASSWORD",
		});
		const result = await api.api.auth.login.post({
			username: "TEST_USER",
			password,
			rememberMe: true,
		});
		expect(result.status).toBe(200);
		expect(result.data?.user.id).toBe(userId);
		const setCookies = result.response.headers.getSetCookie();
		expect(
			setCookies.find((value) => value.startsWith("leonwillow.session_token=")),
		).toContain("Max-Age=");
	});

	test("退出撤销服务端会话，旧 Cookie 和过期会话均不可再使用", async () => {
		let { cookie } = await registerFixture();
		const expires = await database.pool.query(
			'UPDATE "session" SET "expires_at" = now() - interval \'1 second\' RETURNING id',
		);
		expect(expires.rowCount).toBeGreaterThan(0);
		expect(
			(await api.api.auth.session.get({ headers: { cookie } })).status,
		).toBe(401);
		const login = await api.api.auth.login.post({
			username: "test_user",
			password,
			rememberMe: false,
		});
		expect(login.status).toBe(200);
		cookie = login.response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		const result = await api.api.auth.logout.post(undefined, {
			headers: { cookie },
		});
		expect(result.status).toBe(200);
		expect(result.data).toEqual({ success: true });
		expect(
			(await api.api.auth.session.get({ headers: { cookie } })).status,
		).toBe(401);
		const remaining = await database.db.select().from(session);
		expect(remaining.every((row) => row.expiresAt <= new Date())).toBe(true);
	});

	test("官方限流拒绝连续登录尝试，伪造来源地址头不能绕过", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			expect(
				(
					await api.api.auth.login.post({
						username: "missing_user",
						password,
						rememberMe: false,
					})
				).status,
			).toBe(401);
		}
		const limited = await api.api.auth.login.post(
			{ username: "test_user", password, rememberMe: false },
			{
				headers: {
					"x-leonwillow-client-ip": "198.51.100.12",
					"x-real-ip": "198.51.100.13",
					"x-forwarded-for": "198.51.100.14",
				},
			},
		);
		expect(limited.status).toBe(429);
		expect(limited.error?.value).toMatchObject({
			message: "操作过于频繁，请稍后再试。",
		});
	});

	test("受信代理后的两个客户端使用独立的真实数据库限流计数", async () => {
		await app.stop();
		releaseResources?.();
		releaseResources = initializeServerResources({
			auth,
			db: database.db,
			origins: [origin],
			trustedProxyIps: ["127.0.0.1"],
		});
		app = createApp().listen({
			port: 0,
			hostname: "127.0.0.1",
		});
		const proxyApi = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
			headers: { origin },
		});
		const login = (client: string) =>
			proxyApi.api.auth.login.post(
				{ username: "missing_user", password, rememberMe: false },
				{ headers: { "x-real-ip": client } },
			);
		for (let attempt = 0; attempt < 3; attempt++)
			expect((await login("198.51.100.1")).status).toBe(401);
		expect((await login("198.51.100.1")).status).toBe(429);
		expect((await login("198.51.100.2")).status).toBe(401);
	});
});
