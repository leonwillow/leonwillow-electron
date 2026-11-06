/**
 * @file 人员管理与越权防护的数据库集成测试。
 * 创建时间：2026-10-04
 * 修改时间：2026-11-05
 * 版本作用：验证权限真实边界和事务一致性。
 * 被调用：bun run test:api。
 * 调用：真实 PostgreSQL 独立 schema、Better Auth、Eden、应用工厂。
 * 功能：覆盖身份隔离、失效 Cookie 清除、撤权、停用、重置密码和审计回滚。
 * 预期结果：测试不修改 public schema 的账号和授权。
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import {
	accessAudit,
	session,
	user,
	userModuleAccess,
} from "@leonwillow-electron/db/schema";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { type App, createApp } from "../src/app";
import { initializeServerResources } from "../src/server-resources";

describe("统一工作台权限", () => {
	let schemaName: string;
	let database: ReturnType<typeof createDatabase>;
	let auth: ReturnType<typeof createAuth>;
	let app: App;
	let api: ReturnType<typeof treaty<App>>;
	let adminCookie: string;
	let adminId: string;
	let releaseResources: (() => void) | undefined;
	const origin = "http://localhost:3002";
	const password = "test managed password 8";
	const cookieOf = (response: Response) =>
		response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
	const adminHeaders = () => ({ headers: { cookie: adminCookie } });

	beforeEach(async () => {
		schemaName = `access_test_${crypto.randomUUID().replaceAll("-", "")}`;
		const url = new URL(
			process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
		);
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
		await initializeAdmin(auth, database.db, password);
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
		const result = await auth.api.signInUsername({
			body: { username: "admin", password, rememberMe: false },
			asResponse: true,
		});
		expect(result.status).toBe(200);
		adminCookie = cookieOf(result);
		adminId = ((await result.json()) as { user: { id: string } }).user.id;
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

	async function createPerson(username = "member") {
		const created = await api.api.admin.users.post(
			{
				username,
				name: "测试人员",
				password,
				role: "user",
				moduleIds: ["inbox"],
			},
			adminHeaders(),
		);
		expect(created.status).toBe(200);
		if (!created.data) throw new Error(JSON.stringify(created.error));
		const login = await api.api.auth.login.post({
			username,
			password,
			rememberMe: false,
		});
		expect(login.status).toBe(200);
		return { person: created.data.user, cookie: cookieOf(login.response) };
	}

	test("共享插件下并发请求仍使用各自的身份与授权", async () => {
		const { cookie, person } = await createPerson();
		const memberHeaders = { headers: { cookie } };
		const [admin, member, anonymous, allowed, denied] = await Promise.all([
			api.api.access.get(adminHeaders()),
			api.api.access.get(memberHeaders),
			api.api.access.get(),
			api.api.admin.users.get(adminHeaders()),
			api.api.admin.users.get(memberHeaders),
		]);
		expect(admin.data?.user.id).toBe(adminId);
		expect(admin.data?.moduleIds).toContain("documents");
		expect(admin.data?.moduleIds).toContain("inquiries");
		expect(admin.data?.moduleIds).toContain("calculators");
		expect(admin.data?.moduleIds).toHaveLength(10);
		expect(member.data?.user.id).toBe(person.id);
		expect(member.data?.moduleIds).toEqual(["inbox"]);
		expect(anonymous.status).toBe(401);
		expect(allowed.status).toBe(200);
		expect(denied.status).toBe(403);
		expect(denied.error?.value).toMatchObject({ code: "ADMIN_REQUIRED" });
	});

	test("权限检查拒绝过期会话时仍转交清除 Cookie 的响应头", async () => {
		const { cookie, person } = await createPerson();
		await database.db
			.update(session)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(session.userId, person.id));
		const result = await api.api.access.get({ headers: { cookie } });
		expect(result.status).toBe(401);
		expect(result.error?.value).toMatchObject({ code: "UNAUTHENTICATED" });
		expect(result.response.headers.get("cache-control")).toBe("no-store");
		expect(result.response.headers.getSetCookie()).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/^leonwillow\.session_token=;.*Max-Age=0/),
			]),
		);
	});

	test("管理员拥有全部功能，普通人员默认拒绝越权，未知功能也拒绝", async () => {
		expect((await api.api.access.get()).status).toBe(401);
		expect((await api.api.admin.users.get()).status).toBe(401);
		const admin = await api.api.access.get(adminHeaders());
		expect(admin.data?.moduleIds).toContain("inquiries");
		expect(admin.data?.moduleIds).toContain("calculators");
		expect(admin.data?.moduleIds).toHaveLength(10);
		expect(admin.data).not.toHaveProperty("sessionId");
		const { cookie } = await createPerson();
		const memberAccess = await api.api.access.get({ headers: { cookie } });
		const memberId = memberAccess.data?.user.id ?? "";
		expect(
			(
				await api.api.admin
					.users({ userId: memberId })
					.patch(
						{ name: "越权", role: "admin", disabled: false, moduleIds: [] },
						{ headers: { cookie } },
					)
			).status,
		).toBe(403);
		expect(
			(
				await api.api.admin
					.users({ userId: adminId })
					.password.post({ password }, { headers: { cookie } })
			).status,
		).toBe(403);
		expect(
			(await api.api.access.get({ headers: { cookie } })).data?.moduleIds,
		).toEqual(["inbox"]);
		expect(
			(
				await api.api.access
					.modules({ moduleId: "inbox" })
					.get({ headers: { cookie } })
			).status,
		).toBe(200);
		expect(
			(
				await api.api.access
					.modules({ moduleId: "reports" })
					.get({ headers: { cookie } })
			).status,
		).toBe(403);
		expect(
			(
				await api.api.access
					.modules({ moduleId: "unregistered" })
					.get(adminHeaders())
			).status,
		).toBe(403);
		expect(
			(await api.api.admin.users.get({ headers: { cookie } })).status,
		).toBe(403);
		expect(
			(await api.api.admin.audit.get({ headers: { cookie } })).status,
		).toBe(403);
		const denied = await api.api.admin.users.post(
			{
				username: "attack",
				name: "越权",
				password,
				role: "admin",
				moduleIds: [],
			},
			{ headers: { cookie } },
		);
		expect(denied.status).toBe(403);
	});

	test("公开注册与认证库注册均关闭，内部管理员端点未直接暴露", async () => {
		expect(
			(
				await api.api.auth.register.post({
					username: "public_user",
					password,
					agreeToTerms: true,
				})
			).status,
		).toBe(403);
		const result = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-up/email", {
				method: "POST",
				headers: { origin, "content-type": "application/json" },
				body: JSON.stringify({
					name: "公开注册",
					email: "public@example.com",
					password,
					username: "public_user",
				}),
			}),
		);
		expect(result.status).toBe(400);
		expect(
			(
				await fetch(
					`http://127.0.0.1:${app.server?.port}/api/auth/admin/create-user`,
					{
						method: "POST",
						headers: { origin, "content-type": "application/json" },
						body: JSON.stringify({
							name: "越权",
							email: "attack@example.com",
							password,
							role: "admin",
						}),
					},
				)
			).status,
		).toBe(404);
		expect(await database.db.select().from(user)).toHaveLength(1);
	});

	test("撤销授权在旧 Cookie 的下一次请求生效，未授权成员没有默认入口", async () => {
		const { person, cookie } = await createPerson();
		const result = await api.api.admin
			.users({ userId: person.id })
			.patch(
				{ name: person.name, role: "user", disabled: false, moduleIds: [] },
				adminHeaders(),
			);
		expect(result.status).toBe(200);
		expect(
			(await api.api.access.get({ headers: { cookie } })).data?.moduleIds,
		).toEqual([]);
		expect(
			(
				await api.api.access
					.modules({ moduleId: "inbox" })
					.get({ headers: { cookie } })
			).status,
		).toBe(403);
		const retained = await database.db.select().from(userModuleAccess);
		expect(retained).toHaveLength(1);
		expect(retained[0]?.deletedAt).toBeInstanceOf(Date);
		await api.api.admin.users({ userId: person.id }).patch(
			{
				name: person.name,
				role: "user",
				disabled: false,
				moduleIds: ["inbox"],
			},
			adminHeaders(),
		);
		expect(
			(await api.api.access.get({ headers: { cookie } })).data?.moduleIds,
		).toEqual(["inbox"]);
		expect(await database.db.select().from(userModuleAccess)).toHaveLength(1);
	});

	test("停用撤销会话并拒绝登录，重新启用需要重新登录", async () => {
		const { person, cookie } = await createPerson();
		const values = {
			name: person.name,
			role: "user" as const,
			disabled: true,
			moduleIds: ["inbox" as const],
		};
		expect(
			(
				await api.api.admin
					.users({ userId: person.id })
					.patch(values, adminHeaders())
			).status,
		).toBe(200);
		expect((await api.api.access.get({ headers: { cookie } })).status).toBe(
			401,
		);
		expect(
			(
				await api.api.auth.login.post({
					username: "member",
					password,
					rememberMe: false,
				})
			).status,
		).not.toBe(200);
		expect(
			(
				await api.api.admin
					.users({ userId: person.id })
					.patch({ ...values, disabled: false }, adminHeaders())
			).status,
		).toBe(200);
		expect(
			(
				await api.api.auth.login.post({
					username: "member",
					password,
					rememberMe: false,
				})
			).status,
		).toBe(200);
		expect(
			(await api.api.auth.session.get({ headers: { cookie } })).status,
		).toBe(401);
	});

	test("重置密码撤销全部旧会话，记录不包含新旧密码或哈希", async () => {
		const { person, cookie } = await createPerson();
		const next = "new managed password 9";
		expect(
			(
				await api.api.admin
					.users({ userId: person.id })
					.password.post({ password: next }, adminHeaders())
			).status,
		).toBe(200);
		expect((await api.api.access.get({ headers: { cookie } })).status).toBe(
			401,
		);
		expect(
			(
				await api.api.auth.login.post({
					username: "member",
					password,
					rememberMe: false,
				})
			).status,
		).toBe(401);
		expect(
			(
				await api.api.auth.login.post({
					username: "member",
					password: next,
					rememberMe: false,
				})
			).status,
		).toBe(200);
		const history = await api.api.admin.audit.get(adminHeaders());
		expect(
			history.data?.events.some(
				(event) => event.action === "user.password-reset",
			),
		).toBe(true);
		const json = JSON.stringify(history.data);
		expect(json).not.toContain(password);
		expect(json).not.toContain(next);
		expect(json).not.toContain('"password":');
	});

	test("自我停用和降级被拒绝，非法来源与未登记授权均不能写入", async () => {
		for (const values of [
			{ role: "user" as const, disabled: false },
			{ role: "admin" as const, disabled: true },
		]) {
			expect(
				(
					await api.api.admin
						.users({ userId: adminId })
						.patch({ ...values, name: "管理员", moduleIds: [] }, adminHeaders())
				).status,
			).toBe(409);
		}
		const created = {
			username: "bad",
			name: "非法请求",
			password,
			role: "user" as const,
			moduleIds: [],
		};
		expect(
			(
				await api.api.admin.users.post(created, {
					headers: { cookie: adminCookie, origin: "https://untrusted.invalid" },
				})
			).status,
		).toBe(403);
		const invalid = await fetch(
			`http://127.0.0.1:${app.server?.port}/api/admin/users`,
			{
				method: "POST",
				headers: {
					origin,
					cookie: adminCookie,
					"content-type": "application/json",
				},
				body: JSON.stringify({ ...created, moduleIds: ["unregistered"] }),
			},
		);
		expect(invalid.status).toBe(422);
		expect(await database.db.select().from(user)).toHaveLength(1);
		expect(await database.db.select().from(accessAudit)).toHaveLength(0);
	});

	test("重复账号不会产生多余账号或审计，创建响应不含凭据", async () => {
		const { person } = await createPerson();
		expect(person).not.toHaveProperty("password");
		expect(person).not.toHaveProperty("email");
		const duplicate = await api.api.admin.users.post(
			{
				username: "MEMBER",
				name: "重复",
				password,
				role: "admin",
				moduleIds: [],
			},
			adminHeaders(),
		);
		expect(duplicate.status).toBe(409);
		expect(await database.db.select().from(user)).toHaveLength(2);
		expect(await database.db.select().from(accessAudit)).toHaveLength(1);
	});

	test("审计写入失败时账号、凭据和授权一并回滚", async () => {
		await database.pool.query(
			"ALTER TABLE access_audit ADD CONSTRAINT reject_test CHECK (false)",
		);
		const result = await api.api.admin.users.post(
			{
				username: "rollback",
				name: "回滚",
				password,
				role: "user",
				moduleIds: ["inbox"],
			},
			adminHeaders(),
		);
		expect(result.status).toBe(500);
		expect(
			await database.db
				.select()
				.from(user)
				.where(eq(user.username, "rollback")),
		).toHaveLength(0);
		expect(await database.db.select().from(userModuleAccess)).toHaveLength(0);
	});

	test("两位管理员同时停用对方时仅一方提交，等待锁的旧权限被重新核对", async () => {
		const created = await api.api.admin.users.post(
			{
				username: "second",
				name: "另一位管理员",
				password,
				role: "admin",
				moduleIds: [],
			},
			adminHeaders(),
		);
		const secondId = created.data?.user.id ?? "";
		const login = await api.api.auth.login.post({
			username: "second",
			password,
			rememberMe: false,
		});
		const values = {
			name: "管理员",
			role: "admin" as const,
			disabled: true,
			moduleIds: [],
		};
		const results = await Promise.all([
			api.api.admin.users({ userId: secondId }).patch(values, adminHeaders()),
			api.api.admin
				.users({ userId: adminId })
				.patch(values, { headers: { cookie: cookieOf(login.response) } }),
		]);
		expect(results.filter((result) => result.status === 200)).toHaveLength(1);
		const people = await database.db.select().from(user);
		expect(
			people.filter((person) => person.role === "admin" && !person.banned),
		).toHaveLength(1);
	});
});
