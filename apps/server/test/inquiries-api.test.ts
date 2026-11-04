/**
 * @file 笔录案件/人员隔离、自动保存修订和导出链路的真实 API 测试。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：使用现有直连 PostgreSQL 和独立随机 schema 验证迁移及事务。
 * 被调用：test:api；调用：Better Auth、Eden、Drizzle 生成迁移。
 * 预期结果：失败不覆盖笔录，归档禁止写入；测试结束只清理自己的 schema。
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import PizZip from "pizzip";
import { type App, createApp } from "../src/app";
import { initializeServerResources } from "../src/server-resources";
import { inquiryFixture } from "./inquiry-fixture";

const origin = "http://localhost:3002";
const password = "inquiry-integration-test-password";
let database: ReturnType<typeof createDatabase>;
let auth: ReturnType<typeof createAuth>;
let app: App;
let api: ReturnType<typeof treaty<App>>;
let release: (() => void) | undefined;
let schema: string;
let cookie: string;
const cookieOf = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((v) => v.split(";")[0])
		.join("; ");
const headers = (value = cookie) => ({ headers: { cookie: value } });
beforeAll(async () => {
	schema = `inquiries_test_${crypto.randomUUID().replaceAll("-", "")}`;
	const url = new URL(
		process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
	);
	url.searchParams.set("options", `-c search_path=${schema}`);
	database = createDatabase(url.toString());
	await database.pool.query(`CREATE SCHEMA "${schema}"`);
	await migrate(database.db, {
		migrationsFolder: new URL(
			"../../../packages/db/src/migrations",
			import.meta.url,
		).pathname,
		migrationsSchema: schema,
	});
	auth = createAuth({
		db: database.db,
		secret: crypto.randomUUID() + crypto.randomUUID(),
		baseURL: "http://localhost:3000",
		trustedOrigins: [origin],
	});
	await initializeAdmin(auth, database.db, password);
	release = initializeServerResources({
		db: database.db,
		auth,
		origins: [origin],
		trustedProxyIps: [],
	});
	app = createApp().listen({ port: 0, hostname: "127.0.0.1" });
	api = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
		headers: { origin },
		parseDate: false,
		onResponse: (r) =>
			r.ok &&
			r.headers
				.get("content-type")
				?.startsWith(
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				)
				? r.blob()
				: undefined,
	});
	cookie = cookieOf(
		await auth.api.signInUsername({
			body: { username: "admin", password },
			asResponse: true,
		}),
	);
}, 120_000);
afterAll(async () => {
	await app?.stop();
	release?.();
	if (database) {
		await database.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		await database.pool.end();
	}
}, 120_000);
async function createCase(name: string) {
	const result = await api.api.inquiries.cases.post({ name }, headers());
	expect(result.status).toBe(200);
	if (!result.data) throw new Error(JSON.stringify(result.error));
	return result.data;
}
async function member(username: string, granted = true) {
	const result = await api.api.admin.users.post(
		{
			username,
			name: username,
			role: "user",
			password,
			moduleIds: granted ? ["inquiries"] : [],
		},
		headers(),
	);
	expect(result.status).toBe(200);
	return cookieOf(
		await auth.api.signInUsername({
			body: { username, password },
			asResponse: true,
		}),
	);
}

test("目录搜索覆盖文件夹、子笔录和被询问人，状态须命中同一份笔录", async () => {
	const folder = await createCase("目录筛选-文件夹名");
	const empty = await createCase("目录筛选-空文件夹");
	const special = await createCase("目录筛选-百分%号_斜杠\\");
	const fixture = inquiryFixture();
	const records = api.api.inquiries.cases({ caseId: folder.id }).records;
	const draft = await records.post(
		{
			...fixture,
			title: "目录筛选-标题",
			content: { ...fixture.content, subjectName: "目录筛选-张三" },
			requestId: crypto.randomUUID(),
		},
		headers(),
	);
	expect(draft.status).toBe(200);
	expect(
		(
			await records.post(
				{
					...fixture,
					title: "其他已完成笔录",
					status: "final",
					requestId: crypto.randomUUID(),
				},
				headers(),
			)
		).status,
	).toBe(200);
	const standalone = await api.api.inquiries.standalone.post(
		{
			...fixture,
			title: "目录筛选-独立",
			content: { ...fixture.content, subjectName: "目录筛选-李四" },
			status: "final",
			requestId: crypto.randomUUID(),
		},
		headers(),
	);
	expect(standalone.status).toBe(200);
	if (!standalone.data) throw new Error("独立笔录创建失败");
	expect(
		(
			await records.get({ ...headers(), query: { limit: 1 } })
		).data?.records.map((row) => row.title),
	).toEqual(["其他已完成笔录"]);
	async function find(q: string, status?: "draft" | "final") {
		const result = await api.api.inquiries.cases.get({
			...headers(),
			query: { q, status },
		});
		expect(result.status).toBe(200);
		return result.data?.cases.map((row) => row.id);
	}
	expect(await find("目录筛选-文件夹名")).toEqual([folder.id]);
	expect(await find("目录筛选-空文件夹")).toEqual([empty.id]);
	expect(await find("目录筛选-空文件夹", "draft")).toEqual([]);
	expect(await find("目录筛选-标题", "draft")).toEqual([folder.id]);
	expect(await find("目录筛选-标题", "final")).toEqual([]);
	expect(await find(" 目录筛选-张三 ")).toEqual([folder.id]);
	expect(await find("目录筛选-文件夹名", "final")).toEqual([folder.id]);
	expect(await find("目录筛选-李四", "final")).toEqual([
		standalone.data.caseId,
	]);
	expect(await find("目录筛选-独立", "draft")).toEqual([]);
	for (const literal of ["%", "_", "\\"])
		expect(await find(literal)).toEqual([special.id]);
	const summaries = await api.api.inquiries.cases.get({
		...headers(),
		query: { q: "目录筛选-文件夹名" },
	});
	expect(summaries.data?.cases[0]?.recordCount).toBe(2);
	expect(summaries.data?.cases[0]).not.toHaveProperty("content");
	expect(
		(
			await api.api.inquiries
				.cases({ caseId: standalone.data.caseId })
				.records({ recordId: standalone.data.id })
				.put(
					{ ...fixture, title: "目录筛选-重命名结果", revision: 1 },
					headers(),
				)
		).status,
	).toBe(200);
	expect(await find("目录筛选-李四")).toEqual([]);
	expect(await find("目录筛选-独立")).toEqual([]);
	expect(await find("目录筛选-重命名结果")).toEqual([standalone.data.caseId]);
}, 120_000);

test("目录筛选不泄漏其他人员或已删除案件、笔录", async () => {
	const fixture = inquiryFixture();
	const folder = await createCase("目录边界-案件");
	const route = api.api.inquiries.cases({ caseId: folder.id });
	const recordId = crypto.randomUUID();
	expect(
		(
			await route.records.post(
				{ ...fixture, title: "目录边界-笔录", requestId: recordId },
				headers(),
			)
		).status,
	).toBe(200);
	const stranger = await member("inquiry-directory-user");
	const foreign = await api.api.inquiries.standalone.post(
		{
			...fixture,
			title: "目录边界-其他人的笔录",
			requestId: crypto.randomUUID(),
		},
		headers(stranger),
	);
	expect(foreign.status).toBe(200);
	if (!foreign.data) throw new Error("其他人员的独立笔录创建失败");
	const query = { q: "目录边界", status: "draft" as const };
	expect(
		(
			await api.api.inquiries.cases.get({ ...headers(), query })
		).data?.cases.map((row) => row.id),
	).toEqual([folder.id]);
	expect(
		(
			await api.api.inquiries.cases.get({ ...headers(stranger), query })
		).data?.cases.map((row) => row.id),
	).toEqual([foreign.data.caseId]);
	expect(
		(await route.records({ recordId }).delete({ revision: 1 }, headers()))
			.status,
	).toBe(200);
	expect(
		(await api.api.inquiries.cases.get({ ...headers(), query })).data?.cases,
	).toEqual([]);
	expect(
		(
			await api.api.inquiries.cases.get({
				...headers(),
				query: { q: "目录边界-笔录" },
			})
		).data?.cases,
	).toEqual([]);
	expect(
		(
			await route.patch(
				{ name: folder.name, archived: true, revision: 1 },
				headers(),
			)
		).status,
	).toBe(200);
	expect((await route.delete({ revision: 2 }, headers())).status).toBe(200);
	expect(
		(
			await api.api.inquiries.cases.get({
				...headers(),
				query: { q: "目录边界-案件" },
			})
		).data?.cases,
	).toEqual([]);
}, 120_000);
test("案件、笔录和导出严格隔离人员与案件，模块授权可拒绝访问", async () => {
	const folder = await createCase("隔离案件 A");
	const other = await createCase("隔离案件 B");
	const records = api.api.inquiries.cases({ caseId: folder.id }).records;
	const created = await records.post(
		{ ...inquiryFixture(), requestId: crypto.randomUUID() },
		headers(),
	);
	expect(created.status).toBe(200);
	const recordId = created.data?.id ?? "";
	const stranger = await member("inquiry-other-user");
	const denied = await member("inquiry-denied-user", false);
	expect((await api.api.inquiries.cases.get()).status).toBe(401);
	expect((await api.api.inquiries.cases.get(headers(denied))).status).toBe(403);
	expect(
		(await api.api.inquiries.cases.get(headers(stranger))).data?.cases,
	).toEqual([]);
	expect((await records.get(headers(stranger))).status).toBe(404);
	expect((await records({ recordId }).get(headers(stranger))).status).toBe(404);
	expect((await records({ recordId }).file.get(headers(stranger))).status).toBe(
		404,
	);
	expect(
		(
			await api.api.inquiries
				.cases({ caseId: other.id })
				.records({ recordId })
				.get(headers())
		).status,
	).toBe(404);
	expect(
		(
			await api.api.inquiries.cases.post(
				{ name: "越源测试" },
				{ headers: { cookie, origin: "https://untrusted.invalid" } },
			)
		).status,
	).toBe(403);
}, 120_000);
test("草稿重试幂等、保存冲突不覆盖、归档与删除隔离写入，Word 可下载", async () => {
	const folder = await createCase("保存测试");
	const route = api.api.inquiries.cases({ caseId: folder.id });
	const draft = inquiryFixture();
	const requestId = crypto.randomUUID();
	const create = await route.records.post({ ...draft, requestId }, headers());
	expect(create.status).toBe(200);
	expect(
		(await route.records.post({ ...draft, requestId }, headers())).data?.id,
	).toBe(create.data?.id);
	expect((await route.records.get(headers())).data?.total).toBe(1);
	expect(
		(await api.api.inquiries.cases.get(headers())).data?.cases.find(
			(c) => c.id === folder.id,
		)?.recordCount,
	).toBe(1);
	expect((await route.delete({ revision: 1 }, headers())).status).toBe(409);
	const row = route.records({ recordId: requestId });
	const changed = { ...draft, title: "新标题", revision: 1 };
	const saved = await row.put(changed, headers());
	expect(saved.status).toBe(200);
	expect(saved.data?.revision).toBe(2);
	expect(
		(await row.put({ ...changed, title: "旧窗口内容" }, headers())).status,
	).toBe(409);
	expect((await row.get(headers())).data?.title).toBe("新标题");
	expect(
		(
			await row.put(
				{
					...draft,
					revision: 2,
					status: "final",
					content: { ...draft.content, subjectName: "" },
				},
				headers(),
			)
		).status,
	).toBe(400);
	expect(
		(
			await row.put(
				{ ...draft, title: "完成笔录", revision: 2, status: "final" },
				headers(),
			)
		).status,
	).toBe(200);
	const file = await row.file.get(headers());
	expect(file.status).toBe(200);
	if (!(file.data instanceof Blob)) throw new Error("未返回 Word 二进制");
	expect(
		new PizZip(await file.data.arrayBuffer())
			.file("word/document.xml")
			?.asText(),
	).toContain("测试被询问人");
	expect(
		(
			await route.patch(
				{ name: folder.name, archived: true, revision: 1 },
				headers(),
			)
		).status,
	).toBe(200);
	expect((await row.put({ ...draft, revision: 3 }, headers())).status).toBe(
		409,
	);
	expect((await row.file.get(headers())).status).toBe(200);
	expect(
		(
			await route.patch(
				{ name: "重命名案件", archived: false, revision: 2 },
				headers(),
			)
		).status,
	).toBe(200);
	expect((await row.delete({ revision: 2 }, headers())).status).toBe(409);
	expect((await row.delete({ revision: 3 }, headers())).status).toBe(200);
	expect((await row.get(headers())).status).toBe(404);
	expect((await route.records.get(headers())).data?.total).toBe(0);
	expect(
		(await api.api.inquiries.cases.get(headers())).data?.cases.find(
			(c) => c.id === folder.id,
		)?.recordCount,
	).toBe(0);
	expect(
		(
			await route.patch(
				{ name: folder.name, archived: true, revision: 3 },
				headers(),
			)
		).status,
	).toBe(200);
	expect((await route.delete({ revision: 4 }, headers())).status).toBe(200);
	expect((await route.get(headers())).status).toBe(404);
}, 120_000);
test("常用询问人支持修改，检查证号在个人目录唯一且不跨人员可见", async () => {
	const route = api.api.inquiries.inquirers;
	const created = await route.post(
		{ name: "测试询问人", badgeNumber: "TEST-123" },
		headers(),
	);
	expect(created.status).toBe(200);
	expect(
		(await route.post({ name: "同证号", badgeNumber: "TEST-123" }, headers()))
			.status,
	).toBe(409);
	const stranger = await member("inquiry-inquirer-other");
	expect((await route.get(headers(stranger))).data?.inquirers).toEqual([]);
	const person = route({ inquirerId: created.data?.id ?? "" });
	expect(
		(
			await person.put(
				{ name: "新姓名", badgeNumber: "TEST-123", revision: 1 },
				headers(),
			)
		).status,
	).toBe(200);
	expect((await person.delete({ revision: 1 }, headers())).status).toBe(409);
	expect((await person.delete({ revision: 2 }, headers())).status).toBe(200);
	expect((await route.get(headers())).data?.inquirers).toEqual([]);
	const retained = await database.pool.query(
		"select deleted_at, deleted_by from inquiry_inquirer where id = $1",
		[created.data?.id],
	);
	expect(retained.rows[0]?.deleted_at).toBeTruthy();
	expect(retained.rows[0]?.deleted_by).toBeTruthy();
	const restored = await route.post(
		{ name: "恢复的询问人", badgeNumber: "TEST-123" },
		headers(),
	);
	expect(restored.status).toBe(200);
	expect(restored.data?.id).toBe(created.data?.id);
	expect(restored.data?.revision).toBe(4);
}, 120_000);

test("独立笔录原子创建且并发重试幂等，摘要列表不暴露正文并隔离人员", async () => {
	const requestId = crypto.randomUUID();
	const input = { ...inquiryFixture(), requestId };
	const endpoint = api.api.inquiries.standalone;
	const created = await Promise.all([
		endpoint.post(input, headers()),
		endpoint.post(input, headers()),
	]);
	for (const result of created) {
		expect(result.status).toBe(200);
		expect(result.data?.id).toBe(requestId);
		expect(result.data?.caseId).toBe(requestId);
	}
	const route = api.api.inquiries.cases({ caseId: requestId });
	expect((await route.get(headers())).data?.kind).toBe("standalone");
	expect((await route.records.get(headers())).data?.total).toBe(1);
	const list = await api.api.inquiries.cases.get(headers());
	const entry = list.data?.cases.find((row) => row.id === requestId);
	expect(entry?.kind).toBe("standalone");
	expect(entry?.record?.id).toBe(requestId);
	expect(entry?.record?.title).toBe(input.title);
	expect(entry?.record && Object.keys(entry.record).sort()).toEqual([
		"id",
		"revision",
		"status",
		"title",
		"updatedAt",
	]);
	expect(JSON.stringify(list.data)).not.toContain(
		input.content.subjectIdNumber,
	);
	const folder = await createCase("独立笔录旁的普通案件");
	expect(folder.kind).toBe("folder");
	expect(
		(await api.api.inquiries.cases.get(headers())).data?.cases.find(
			(row) => row.id === folder.id,
		)?.record,
	).toBeNull();
	expect(
		(
			await route.records.post(
				{ ...input, requestId: crypto.randomUUID() },
				headers(),
			)
		).status,
	).toBe(409);
	expect((await route.records.get(headers())).data?.total).toBe(1);
	const stranger = await member("inquiry-standalone-other");
	expect((await endpoint.post(input, headers(stranger))).status).toBe(404);
	expect((await route.get(headers(stranger))).status).toBe(404);
	expect(
		(await route.records({ recordId: requestId }).file.get(headers(stranger)))
			.status,
	).toBe(404);
	expect(
		(await api.api.inquiries.cases.get(headers(stranger))).data?.cases,
	).toEqual([]);
	expect((await endpoint.post(input)).status).toBe(401);
	const denied = await member("inquiry-standalone-denied", false);
	expect((await endpoint.post(input, headers(denied))).status).toBe(403);
	const record = route.records({ recordId: requestId });
	expect(
		(
			await record.put(
				{ ...inquiryFixture(), title: "独立笔录的新标题", revision: 1 },
				headers(),
			)
		).status,
	).toBe(200);
	expect(
		(await api.api.inquiries.cases.get(headers())).data?.cases.find(
			(row) => row.id === requestId,
		)?.record?.title,
	).toBe("独立笔录的新标题");
	expect((await record.delete({ revision: 2 }, headers())).status).toBe(200);
	expect(
		(await api.api.inquiries.cases.get(headers())).data?.cases.some(
			(row) => row.id === requestId,
		),
	).toBe(false);
	expect((await endpoint.post(input, headers())).status).toBe(409);
	const retained = await database.pool.query(
		"select deleted_at, deleted_by from inquiry_record where id = $1",
		[requestId],
	);
	expect(retained.rows[0]?.deleted_at).toBeTruthy();
	expect(retained.rows[0]?.deleted_by).toBeTruthy();
}, 120_000);

test("独立笔录校验和 ID 冲突不会留下空容器或覆盖已有笔录", async () => {
	const folder = await createCase("独立笔录冲突验证");
	const requestId = crypto.randomUUID();
	const input = { ...inquiryFixture(), requestId };
	const route = api.api.inquiries.cases({ caseId: folder.id });
	expect((await route.records.post(input, headers())).status).toBe(200);
	expect(
		(await api.api.inquiries.standalone.post(input, headers())).status,
	).toBe(409);
	expect(
		(await api.api.inquiries.cases({ caseId: requestId }).get(headers()))
			.status,
	).toBe(404);
	expect(
		(await route.records({ recordId: requestId }).get(headers())).data?.title,
	).toBe(input.title);
	const invalidId = crypto.randomUUID();
	expect(
		(
			await api.api.inquiries.standalone.post(
				{
					...input,
					requestId: invalidId,
					status: "final",
					content: { ...input.content, subjectName: "" },
				},
				headers(),
			)
		).status,
	).toBe(400);
	expect(
		(await api.api.inquiries.cases({ caseId: invalidId }).get(headers()))
			.status,
	).toBe(404);
}, 120_000);
