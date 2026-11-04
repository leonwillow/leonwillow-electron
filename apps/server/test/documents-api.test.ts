/**
 * @file 文书取号、模板历史和人员越权的真实 API 集成测试。
 * 创建时间：2026-10-10；修改时间：2026-10-20。
 * 版本作用：真实 PostgreSQL/Better Auth/Eden 验证并发、幂等及不可回收号码。
 * 被调用：test:api；调用：随机独立 schema、应用工厂、生成的数据库迁移。
 * 预期结果：只创建和清理测试 schema，不修改已有账号、案件和文书。
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import {
	documentRecord,
	documentRevision,
	documentType,
} from "@leonwillow-electron/db/schema";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import PizZip from "pizzip";
import { type App, createApp } from "../src/app";
import { initializeServerResources } from "../src/server-resources";

const origin = "http://localhost:3002";
const password = "document-integration-test-password";
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
		.map((value) => value.split(";")[0])
		.join("; ");
const headers = (value = cookie) => ({ headers: { cookie: value } });
beforeEach(async () => {
	schema = `documents_test_${crypto.randomUUID().replaceAll("-", "")}`;
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
		onResponse: (response) =>
			response.ok &&
			response.headers
				.get("content-type")
				?.startsWith(
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				)
				? response.blob()
				: undefined,
	});
	cookie = cookieOf(
		await auth.api.signInUsername({
			body: { username: "admin", password },
			asResponse: true,
		}),
	);
});
afterEach(async () => {
	await app?.stop();
	release?.();
	release = undefined;
	if (database) {
		await database.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		await database.pool.end();
	}
});
async function newType(name = "询问通知书", nextNumber = 43) {
	const created = await api.api.documents.types.sample.post(
		{ name, prefix: "滇税三稽查", year: 2025, nextNumber },
		headers(),
	);
	expect(created.status).toBe(200);
	if (!created.data) throw new Error(JSON.stringify(created.error));
	return created.data.id;
}
async function draft(typeId: string, year = 2025) {
	const types = await api.api.documents.types.get(headers());
	const fields =
		types.data?.types.find((type) => type.id === typeId)?.fields ?? [];
	return {
		requestId: crypto.randomUUID(),
		typeId,
		year,
		subject: "测试涉税事项",
		values: Object.fromEntries(
			fields.map((field) => [
				field.key,
				field.kind === "date"
					? "2026-10-10"
					: field.kind === "time"
						? "10:00"
						: "测试信息",
			]),
		),
	};
}
async function member(username: string, granted = true) {
	const created = await api.api.admin.users.post(
		{
			username,
			name: username,
			role: "user",
			password,
			moduleIds: granted ? ["documents"] : [],
		},
		headers(),
	);
	expect(created.status).toBe(200);
	const response = await auth.api.signInUsername({
		body: { username, password },
		asResponse: true,
	});
	return cookieOf(response);
}
test("类型目录保留可见历史类型，移除空的归档类型并执行模块授权", async () => {
	const activeId = await newType("当前文书类型");
	const historicId = await newType("历史文书类型");
	const emptyId = await newType("空文书类型");
	const reader = await member("document-catalog-reader");
	const outsider = await member("document-catalog-outsider", false);
	const initial = await api.api.documents.catalog.get(headers(reader));
	expect(initial.status).toBe(200);
	expect(initial.data?.types).toEqual([
		{
			id: activeId,
			name: "当前文书类型",
			prefix: "滇税三稽查",
			archived: false,
		},
		{
			id: historicId,
			name: "历史文书类型",
			prefix: "滇税三稽查",
			archived: false,
		},
		{ id: emptyId, name: "空文书类型", prefix: "滇税三稽查", archived: false },
	]);
	const made = await api.api.documents.records.post(
		await draft(historicId),
		headers(),
	);
	expect(made.status).toBe(200);
	for (const typeId of [historicId, emptyId]) {
		expect(
			(
				await api.api.documents
					.types({ typeId })
					.delete({ revision: 1 }, headers())
			).status,
		).toBe(200);
	}
	expect(
		(await api.api.documents.catalog.get(headers(reader))).data?.types,
	).toEqual([
		{
			id: activeId,
			name: "当前文书类型",
			prefix: "滇税三稽查",
			archived: false,
		},
		{
			id: historicId,
			name: "历史文书类型",
			prefix: "滇税三稽查",
			archived: true,
		},
	]);
	expect(
		(await api.api.documents.types.get(headers(reader))).data?.types.map(
			(type) => type.id,
		),
	).toEqual([activeId]);
	expect(
		(
			await api.api.documents
				.records({ recordId: made.data?.id ?? "" })
				.delete({ revision: 1 }, headers())
		).status,
	).toBe(200);
	expect(
		(await api.api.documents.catalog.get(headers(reader))).data?.types.map(
			(type) => type.id,
		),
	).toEqual([activeId]);
	expect((await api.api.documents.catalog.get(headers(outsider))).status).toBe(
		403,
	);
	expect((await api.api.documents.catalog.get()).status).toBe(401);
}, 120_000);
test("同年并发顺序取号、重试幂等、类型和年份独立、失败不占号", async () => {
	const id = await newType();
	const input = await draft(id);
	const { requestId: ignored, ...previewInput } = input;
	void ignored;
	expect(
		(await api.api.documents.preview.post(previewInput, headers())).status,
	).toBe(200);
	const invalid = await api.api.documents.records.post(
		{ ...input, values: { ...input.values, 询问日期: "2026-02-30" } },
		headers(),
	);
	expect(invalid.status).toBe(400);
	const repeated = await Promise.all(
		Array.from({ length: 6 }, () =>
			api.api.documents.records.post(input, headers()),
		),
	);
	expect(repeated.every((result) => result.status === 200)).toBe(true);
	expect(new Set(repeated.map((result) => result.data?.id)).size).toBe(1);
	expect(repeated[0]?.data?.documentNumber).toBe("滇税三稽查〔2025〕43号");
	const results = await Promise.all(
		Array.from({ length: 12 }, () =>
			api.api.documents.records.post(
				{ ...input, requestId: crypto.randomUUID() },
				headers(),
			),
		),
	);
	expect(results.every((result) => result.status === 200)).toBe(true);
	expect(
		new Set(results.map((result) => result.data?.documentNumber)).size,
	).toBe(12);
	expect(
		(
			await api.api.documents
				.types({ typeId: id })
				.sequence.get({ ...headers(), query: { year: 2025 } })
		).data?.nextNumber,
	).toBe(56);
	expect(
		(
			await api.api.documents.records.post(
				{ ...input, requestId: crypto.randomUUID(), year: 2026 },
				headers(),
			)
		).data?.documentNumber,
	).toBe("滇税三稽查〔2026〕1号");
	const another = await newType("另一类文书", 1);
	expect(
		(await api.api.documents.records.post(await draft(another), headers())).data
			?.documentNumber,
	).toBe("滇税三稽查〔2025〕1号");
	expect(
		(
			await api.api.documents.records.post(
				{ ...input, values: { ...input.values, 受询问人: "不同内容" } },
				headers(),
			)
		).status,
	).toBe(409);
}, 120_000);
test("仅填受询问人即可取号和修改，Word 按需补充且不再占号", async () => {
	const typeId = await newType();
	const alice = await member("document-minimal-alice");
	const bob = await member("document-minimal-bob");
	const input = {
		requestId: crypto.randomUUID(),
		typeId,
		year: 2025,
		subject: "张三",
		values: { 受询问人: "张三" },
	};
	const created = await api.api.documents.records.post(input, headers(alice));
	expect(created.status).toBe(200);
	expect(created.data?.documentNumber).toBe("滇税三稽查〔2025〕43号");
	expect(
		(await api.api.documents.records.post(input, headers(alice))).data?.id,
	).toBe(created.data?.id);
	const record = api.api.documents.records({
		recordId: created.data?.id ?? "",
	});
	const saved = await record.get(headers(bob));
	expect(saved.data?.record.values.受询问人).toBe("张三");
	expect(saved.data?.record.values.询问日期).toBe("");
	expect((await record.preview.get(headers(bob))).status).toBe(200);
	expect((await record.file.get(headers(alice))).status).toBe(400);
	expect(
		(
			await record.patch(
				{ subject: "李四", values: { 受询问人: "李四" }, revision: 1 },
				headers(alice),
			)
		).status,
	).toBe(200);
	const complete = await draft(typeId);
	expect(
		(
			await record.patch(
				{ subject: "李四", values: complete.values, revision: 2 },
				headers(alice),
			)
		).status,
	).toBe(200);
	expect((await record.file.get(headers(bob))).status).toBe(200);
	expect((await record.get(headers(alice))).data?.record.documentNumber).toBe(
		"滇税三稽查〔2025〕43号",
	);
	expect(
		(
			await api.api.documents
				.types({ typeId })
				.sequence.get({ ...headers(), query: { year: 2025 } })
		).data?.nextNumber,
	).toBe(44);
}, 120_000);
test("全部人员可查看，普通人员仅修改本人且不能管理模板、改号或删除", async () => {
	const typeId = await newType();
	const alice = await member("document-alice");
	const bob = await member("document-bob");
	const outsider = await member("document-outsider", false);
	const input = await draft(typeId);
	const made = await api.api.documents.records.post(input, headers(alice));
	expect(made.status).toBe(200);
	const id = made.data?.id ?? "";
	const record = api.api.documents.records({ recordId: id });
	expect((await record.get(headers(bob))).status).toBe(200);
	expect((await api.api.documents.records.get(headers(bob))).data?.total).toBe(
		1,
	);
	expect((await record.file.get(headers(bob))).status).toBe(200);
	const update = { subject: "修改事项", values: input.values, revision: 1 };
	expect((await record.patch(update, headers(bob))).status).toBe(403);
	expect((await record.preview.post(update, headers(bob))).status).toBe(403);
	expect((await record.delete({ revision: 1 }, headers(alice))).status).toBe(
		403,
	);
	expect(
		(
			await api.api.documents.types.sample.post(
				{ name: "越权", prefix: "越权", year: 2025, nextNumber: 1 },
				headers(alice),
			)
		).status,
	).toBe(403);
	expect(
		(
			await api.api.documents
				.types({ typeId })
				.sequence.post({ year: 2025, nextNumber: 99 }, headers(alice))
		).status,
	).toBe(403);
	expect((await record.get(headers(outsider))).status).toBe(403);
	expect((await record.get()).status).toBe(401);
	expect((await record.patch(update, headers(alice))).status).toBe(200);
	expect((await record.patch(update, headers(alice))).status).toBe(409);
	const details = await record.get(headers(bob));
	expect(details.data?.record.documentNumber).toBe(made.data?.documentNumber);
	expect(details.data?.history).toHaveLength(2);
}, 120_000);
test("替换与删除模板保留历史文书，文书删除不回收序号并保留审计", async () => {
	const typeId = await newType();
	const input = await draft(typeId);
	const made = await api.api.documents.records.post(input, headers());
	const id = made.data?.id ?? "";
	const types = await api.api.documents.types.get(headers());
	const type = types.data?.types.find((value) => value.id === typeId);
	if (!type) throw new Error("没有类型");
	const oldFile = await api.api.documents
		.types({ typeId })
		.template.get(headers());
	const oldBlob = oldFile.data;
	expect(oldBlob).toBeInstanceOf(Blob);
	if (!(oldBlob instanceof Blob)) throw new Error("模板未返回 Blob");
	const zip = new PizZip(await oldBlob.arrayBuffer());
	zip.file(
		"word/document.xml",
		zip
			.file("word/document.xml")
			?.asText()
			.replace("询问通知书", "新版通知书") ?? "",
	);
	expect(
		(
			await api.api.documents.types({ typeId }).template.post(
				{
					revision: type.revision,
					file: new File([zip.generate({ type: "uint8array" })], "new.docx"),
				},
				headers(),
			)
		).status,
	).toBe(200);
	const historic = await api.api.documents
		.records({ recordId: id })
		.file.get(headers());
	if (!(historic.data instanceof Blob)) throw new Error("文书未返回 Blob");
	expect(
		new PizZip(await historic.data.arrayBuffer())
			.file("word/document.xml")
			?.asText(),
	).toContain("询问通知书");
	expect(
		(
			await api.api.documents
				.types({ typeId })
				.sequence.post({ year: 2025, nextNumber: 43 }, headers())
		).status,
	).toBe(409);
	expect(
		(
			await api.api.documents
				.records({ recordId: id })
				.delete({ revision: 1 }, headers())
		).status,
	).toBe(200);
	expect(
		(await api.api.documents.records({ recordId: id }).file.get(headers()))
			.status,
	).toBe(404);
	expect(
		(
			await api.api.documents.records.post(
				{ ...input, requestId: crypto.randomUUID() },
				headers(),
			)
		).data?.documentNumber,
	).toBe("滇税三稽查〔2025〕44号");
	expect(
		(
			await database.db
				.select()
				.from(documentRecord)
				.where(eq(documentRecord.id, id))
		)[0]?.deletedAt,
	).not.toBeNull();
	expect(
		await database.db
			.select()
			.from(documentRevision)
			.where(eq(documentRevision.recordId, id)),
	).toHaveLength(2);
	expect(
		(
			await api.api.documents
				.types({ typeId })
				.delete({ revision: 2 }, headers())
		).status,
	).toBe(200);
	expect(
		(
			await database.db
				.select()
				.from(documentType)
				.where(eq(documentType.id, typeId))
		)[0]?.deletedAt,
	).not.toBeNull();
	const list = await api.api.documents.records.get(headers());
	const remainingId = list.data?.records[0]?.id ?? "";
	expect(
		(
			await api.api.documents
				.records({ recordId: remainingId })
				.file.get(headers())
		).status,
	).toBe(200);
	expect(
		(
			await api.api.documents
				.records({ recordId: remainingId })
				.patch(
					{ subject: "删除模板后仍可改", values: input.values, revision: 1 },
					headers(),
				)
		).status,
	).toBe(200);
	expect(
		(
			await api.api.documents.records.post(
				{ ...input, requestId: crypto.randomUUID() },
				headers(),
			)
		).status,
	).toBe(404);
}, 120_000);
