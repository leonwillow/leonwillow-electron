/**
 * @file 资金调查 API 与双数据库的真实集成测试。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：验证导入、权限、幂等、图恢复和时间路径。
 * 被调用：test:api；调用：独立 PG schema、真实 Neo4j/Bun/Eden/Better Auth。
 * 预期结果：只清理本次随机案件与 schema，不修改已有测试案件。
 */
import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import {
	DeleteBucketCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { treaty } from "@elysiajs/eden";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import { createDatabase } from "@leonwillow-electron/db";
import {
	fundsCase,
	fundsJob,
	fundsJobFile,
	fundsRevision,
	fundsSource,
	fundsTransaction,
	userModuleAccess,
} from "@leonwillow-electron/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import neo4j from "neo4j-driver";
import { type App, createApp } from "../src/app";
import { csvDocument, standardHeaders } from "../src/modules/funds/export";
import { createFundsFileStore } from "../src/modules/funds/file-store";
import { createFundsGraph } from "../src/modules/funds/graph";
import { processNextFundsJob } from "../src/modules/funds/jobs";
import { parseStatement } from "../src/modules/funds/parser";
import { initializeServerResources } from "../src/server-resources";

const fileConfig = {
	RUSTFS_ENDPOINT: process.env.RUSTFS_ENDPOINT ?? "http://127.0.0.1:9000",
	RUSTFS_BUCKET: `funds-test-${crypto.randomUUID()}`,
	RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY ?? "local-funds",
	RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY ?? "local-funds-files-dev",
};
const files = createFundsFileStore(fileConfig);
const s3 = new S3Client({
	endpoint: fileConfig.RUSTFS_ENDPOINT,
	region: "us-east-1",
	forcePathStyle: true,
	credentials: {
		accessKeyId: fileConfig.RUSTFS_ACCESS_KEY,
		secretAccessKey: fileConfig.RUSTFS_SECRET_KEY,
	},
});
afterAll(async () => {
	try {
		while (true) {
			const page = await s3.send(
				new ListObjectsV2Command({ Bucket: fileConfig.RUSTFS_BUCKET }),
			);
			if (!page.Contents?.length) break;
			await s3.send(
				new DeleteObjectsCommand({
					Bucket: fileConfig.RUSTFS_BUCKET,
					Delete: {
						Objects: page.Contents.map((object) => ({ Key: object.Key })),
					},
				}),
			);
		}
		await s3.send(
			new DeleteBucketCommand({ Bucket: fileConfig.RUSTFS_BUCKET }),
		);
	} catch (error) {
		if (!(error instanceof Error) || error.name !== "NoSuchBucket") throw error;
	} finally {
		files.close();
		s3.destroy();
	}
});
let schema: string;
let database: ReturnType<typeof createDatabase>;
let graph: ReturnType<typeof createFundsGraph>;
let app: App;
let api: ReturnType<typeof treaty<App>>;
let release: (() => void) | undefined;
let auth: ReturnType<typeof createAuth>;
const caseIds: string[] = [];
const origin = "http://localhost:3002";
let cookie = "";
const cookieOf = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
const statement = (name = "bank.csv") =>
	new File(
		[
			"本方账号,本方户名,对方账号,对方户名,借贷方向,交易日期,交易时间,交易金额,币种,交易流水号,摘要\n10001,甲,20001,乙,借,2022-01-05,10:00:00,100.00,CNY,one,转账\n20001,乙,10001,甲,贷,2022-01-05,10:00:00,100.00,CNY,two,收款\n20001,乙,30001,丙,借,2022-01-05,11:00:00,90.00,CNY,three,转出\n30001,丙,10001,甲,借,2022-01-05,09:00:00,80.00,CNY,four,早于起点\n",
		],
		name,
		{ type: "text/csv" },
	);

beforeEach(async () => {
	schema = `funds_test_${crypto.randomUUID().replaceAll("-", "")}`;
	const url = new URL(process.env.DATABASE_URL ?? "");
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
	await initializeAdmin(auth, database.db, "funds-test-password-2026");
	graph = createFundsGraph(
		process.env.NEO4J_URI ?? "bolt://127.0.0.1:7687",
		process.env.NEO4J_USER ?? "neo4j",
		process.env.NEO4J_PASSWORD ?? "local-funds-dev",
	);
	release = initializeServerResources({
		fundsFiles: files,
		db: database.db,
		auth,
		fundsGraph: graph,
		origins: [origin],
		trustedProxyIps: [],
	});
	app = createApp().listen({ port: 0, hostname: "127.0.0.1" });
	const login = await auth.api.signInUsername({
		body: { username: "admin", password: "funds-test-password-2026" },
		asResponse: true,
	});
	cookie = cookieOf(login);
	api = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
		headers: { origin, cookie },
	});
});
afterEach(async () => {
	await app?.stop();
	release?.();
	if (caseIds.length) {
		const driver = neo4j.driver(
			process.env.NEO4J_URI ?? "bolt://127.0.0.1:7687",
			neo4j.auth.basic(
				process.env.NEO4J_USER ?? "neo4j",
				process.env.NEO4J_PASSWORD ?? "local-funds-dev",
			),
		);
		try {
			await driver.executeQuery(
				"MATCH (n) WHERE n.caseId IN $ids DETACH DELETE n",
				{ ids: caseIds.splice(0) },
			);
		} finally {
			await driver.close();
		}
	}
	await graph?.close();
	if (database) {
		await database.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		await database.pool.end();
	}
});
async function newCase() {
	const result = await api.api.funds.cases.post({ name: "独立测试案件" });
	expect(result.status).toBe(200);
	const id = result.data?.id;
	if (!id) throw new Error(JSON.stringify(result.error));
	caseIds.push(id);
	return id;
}

async function drainJobs() {
	for (let i = 0; i < 20; i++)
		if (
			!(await processNextFundsJob({
				baseUrl: "https://unused.invalid",
				apiKey: "",
				model: "test",
			}))
		)
			return;
	throw new Error("任务队列未能排空");
}
async function jobResult(caseId: string, jobId?: string) {
	await drainJobs();
	const jobs = await api.api.funds.cases({ caseId }).jobs.get();
	return jobs.data?.find((job) => job.id === jobId);
}

test("跨案只提示，确认才纳入，可排除，任务与下载不能越案", async () => {
	const original = await newCase();
	const target = await newCase();
	await api.api.funds
		.cases({ caseId: original })
		.import.post({ files: [statement()] });
	const targetApi = api.api.funds.cases({ caseId: target });
	const upload = await targetApi.import.post({
		files: [
			new File(
				[
					csvDocument(standardHeaders, [
						[
							"10001",
							"甲",
							"40001",
							"丁",
							"借",
							"2022-02-01 12:00:00",
							"50.00",
							"",
							"independent",
							"本案独立取得",
							"",
							"",
							"",
						],
					]),
				],
				"target.csv",
			),
		],
	});
	await drainJobs();
	expect((await targetApi.summary.get()).data?.transactions).toBe(1);
	const hints = await targetApi.links.get();
	expect(
		hints.data?.matches.some(
			(m) => m.originCaseId === original && m.account === "10001",
		),
	).toBe(true);
	expect(JSON.stringify(hints.data)).not.toContain("amountMinor");
	const incoming = await targetApi.links.post({
		originCaseId: original,
		account: "10001",
		revision: 1,
	});
	expect(incoming.status).toBe(200);
	await drainJobs();
	expect((await targetApi.summary.get()).data?.transactions).toBe(3);
	const includedId = incoming.data?.id;
	if (!includedId) throw new Error("缺少纳入ID");
	expect(
		(
			await api.api.funds
				.cases({ caseId: original })
				.links({ inclusionId: includedId })
				.delete()
		).status,
	).toBe(404);
	expect(
		(await targetApi.links({ inclusionId: includedId }).delete()).status,
	).toBe(200);
	await drainJobs();
	expect((await targetApi.summary.get()).data?.transactions).toBe(1);
	expect(
		await database.db
			.select()
			.from(fundsTransaction)
			.where(
				and(
					eq(fundsTransaction.caseId, target),
					isNull(fundsTransaction.deletedAt),
				),
			),
	).toHaveLength(1);
	expect(
		(
			await database.db
				.select()
				.from(fundsTransaction)
				.where(
					and(
						eq(fundsTransaction.caseId, target),
						isNotNull(fundsTransaction.deletedAt),
					),
				)
		).length,
	).toBeGreaterThan(0);
	expect(
		(await api.api.funds.cases({ caseId: original }).summary.get()).data
			?.transactions,
	).toBe(3);
	const jobs = await targetApi.jobs.get();
	const job = jobs.data?.find((j) => j.id === upload.data?.id);
	const file = job?.files[0];
	if (!job || !file) throw new Error("缺少标准文件");
	expect(
		(
			await targetApi
				.jobs({ jobId: job.id })
				.files({ fileId: file.id })
				.get({ query: { format: "csv" } })
		).data,
	).toContain("本方账号");
	expect(
		(
			await api.api.funds
				.cases({ caseId: original })
				.jobs({ jobId: job.id })
				.files({ fileId: file.id })
				.get()
		).status,
	).toBe(404);
}, 30_000);

test("后台租约过期可恢复，重复执行不会增加图中的交易边", async () => {
	const id = await newCase();
	const endpoint = api.api.funds.cases({ caseId: id });
	const queued = await endpoint.import.post({ files: [statement()] });
	if (!queued.data) throw new Error("没有任务");
	await database.db.update(fundsJob).set({
		status: "running",
		leaseOwner: "dead-worker",
		leaseUntil: new Date(0),
	});
	const recovered = await jobResult(id, queued.data.id);
	expect(recovered?.status).toBe("completed");
	expect((await endpoint.summary.get()).data?.transactions).toBe(3);
	await endpoint.sync.post();
	await drainJobs();
	expect((await endpoint.summary.get()).data?.transactions).toBe(3);
}, 30_000);

test("完整文件上传、双边归并、精确图金额、时间路径和再次导入幂等", async () => {
	const id = await newCase();
	const endpoint = api.api.funds.cases({ caseId: id });
	const imported = await endpoint.import.post({ files: [statement()] });
	expect(imported.status).toBe(200);
	expect(imported.data?.status).toBe("queued");
	expect((await endpoint.get()).data?.revision).toBe(0);
	expect((await jobResult(id, imported.data?.id))?.result?.graphReady).toBe(
		true,
	);
	const details = await endpoint.get();
	expect(details.data?.totals).toMatchObject({
		rawRows: 4,
		observations: 4,
		mirrored: 1,
		transactionCount: 3,
	});
	const summary = await endpoint.summary.get();
	expect(summary.status).toBe(200);
	expect(summary.data?.currencies[0]?.amountMinor).toBe("27000");
	const transactions = await endpoint.transactions.get({
		query: { account: "10001", direction: "out", limit: 50 },
	});
	expect(transactions.data?.total).toBe(1);
	const seed = transactions.data?.edges[0];
	if (!seed) throw new Error("缺少起点");
	const evidence = await endpoint.evidence({ transactionId: seed.id }).get();
	expect(evidence.data?.observations).toHaveLength(2);
	const paths = await endpoint.trace.post({
		account: "10001",
		transaction: seed.id,
		depth: 3,
		from: "",
		to: "",
	});
	expect(paths.status).toBe(200);
	expect(paths.data?.edges).toHaveLength(2);
	expect(paths.data?.edges.some((edge) => edge.amountMinor === "8000")).toBe(
		false,
	);
	const again = await endpoint.import.post({
		files: [statement("renamed.csv")],
	});
	const againResult = (await jobResult(id, again.data?.id))?.result;
	expect(againResult?.skipped).toBe(1);
	expect(againResult?.revision).toBe(1);
	const exported = await endpoint.export.get();
	expect(exported.status).toBe(200);
	expect(exported.data).toContain("本方账号");
	expect(exported.data).toContain("10001");
	const template = await api.api.funds.template.get();
	expect(template.status).toBe(200);
	expect(template.data).toContain('"交易时间"');
	expect(template.data).not.toContain("交易日期");
	expect(template.data).not.toContain("币种");
	if (typeof exported.data !== "string") throw new Error("没有收到标准 CSV");
	const parsed = parseStatement(
		"standard.csv",
		new TextEncoder().encode(exported.data),
	);
	expect(Object.keys(parsed.rows[0]?.fields ?? {})).toHaveLength(13);
	expect(parsed.observations).toHaveLength(4);
	expect(parsed.observations[0]?.timestamp).toBe("2022-01-05T10:00:00+08:00");
	const standardImport = await endpoint.import.post({
		files: [new File([exported.data], "standard.csv", { type: "text/csv" })],
	});
	expect(standardImport.status).toBe(200);
	await drainJobs();
	expect((await endpoint.summary.get()).data?.transactions).toBe(3);
}, 30_000);

test("只有一人流水时完整图保留全部对手、超过200笔的逐笔交易及筛选，案件互不混入", async () => {
	const id = await newCase();
	const endpoint = api.api.funds.cases({ caseId: id });
	const rows = Array.from(
		{ length: 225 },
		(_, i) =>
			`10001,甲,${20001 + i},对手${i},${i % 3 === 0 ? "贷" : "借"},2022-01-05,10:00:00,${100 + i}.00,CNY,single-${i},单方流水`,
	);
	rows.push(
		"10001,甲,20001,对手0,借,2022-01-06,10:00:00,1.00,CNY,repeat-1,另一次付款",
		"10001,甲,20001,对手0,借,2022-01-06,11:00:00,2.00,CNY,repeat-2,另一次付款",
	);
	const upload = await endpoint.import.post({
		files: [
			new File(
				[
					"本方账号,本方户名,对方账号,对方户名,借贷方向,交易日期,交易时间,交易金额,币种,交易流水号,摘要\n",
					rows.join("\n"),
				],
				"single-owner.csv",
				{ type: "text/csv" },
			),
		],
	});
	expect((await jobResult(id, upload.data?.id))?.result?.graphReady).toBe(true);
	const full = await endpoint.graph.get();
	expect(full.status).toBe(200);
	expect(full.data?.total).toBe(227);
	expect(full.data?.edges).toHaveLength(227);
	expect(new Set(full.data?.edges.map((edge) => edge.id)).size).toBe(227);
	expect(full.data?.nodes).toHaveLength(226);
	expect(full.data?.nodes.filter((node) => node.hasStatement)).toHaveLength(1);
	expect(full.data?.nodes.filter((node) => !node.hasStatement)).toHaveLength(
		225,
	);
	const page = await endpoint.transactions.get({
		query: { limit: 50, offset: 50 },
	});
	expect(page.data?.total).toBe(227);
	expect(page.data?.edges).toEqual(full.data?.edges.slice(50, 100));
	const pair = await endpoint.graph.get({
		query: { account: "10001", counterparty: "20001" },
	});
	expect(pair.data?.nodes).toHaveLength(2);
	expect(pair.data?.edges).toHaveLength(3);
	const outbound = await endpoint.graph.get({
		query: {
			account: "10001",
			counterparty: "20001",
			direction: "out",
			from: "2022-01-06",
			to: "2022-01-06",
		},
	});
	expect(outbound.data?.edges.map((edge) => edge.amountMinor)).toEqual([
		"100",
		"200",
	]);
	const none = await endpoint.graph.get({ query: { from: "2030-01-01" } });
	expect(none.data).toEqual({ nodes: [], edges: [], total: 0 });
	const otherId = await newCase();
	const other = api.api.funds.cases({ caseId: otherId });
	const otherUpload = await other.import.post({ files: [statement()] });
	await jobResult(otherId, otherUpload.data?.id);
	expect((await other.graph.get()).data?.edges).toHaveLength(3);
	expect((await endpoint.graph.get()).data?.edges).toHaveLength(227);
}, 30_000);

test("批次拒绝原子性、案件归属隔离、非法来源与未登录拒绝", async () => {
	const id = await newCase();
	const invalid = await api.api.funds.cases({ caseId: id }).import.post({
		files: [statement(), new File(["not a statement"], "unsupported.pdf")],
	});
	expect(invalid.status).toBe(400);
	expect(await database.db.select().from(fundsSource)).toHaveLength(0);
	expect(await database.db.select().from(fundsRevision)).toHaveLength(0);
	const created = await auth.api.createUser({
		body: {
			email: "case-member@example.test",
			name: "其他办案人员",
			password: "member-test-password",
			role: "user",
			data: { username: "case_member", displayUsername: "case_member" },
		},
	});
	await database.db
		.insert(userModuleAccess)
		.values({ userId: created.user.id, moduleId: "funds" });
	const login = await auth.api.signInUsername({
		body: { username: "case_member", password: "member-test-password" },
		asResponse: true,
	});
	const endpoint = api.api.funds.cases({ caseId: id });
	const member = { headers: { cookie: cookieOf(login) } };
	expect((await endpoint.get(member)).status).toBe(404);
	expect((await endpoint.graph.get(member)).status).toBe(404);
	expect((await endpoint.graph.get({ headers: { cookie: "" } })).status).toBe(
		401,
	);
	expect((await endpoint.patch({ archived: true }, member)).status).toBe(404);
	expect(
		(await endpoint.sources({ sourceId: "unknown" }).original.get(member))
			.status,
	).toBe(404);
	expect(
		(await endpoint.transactions.get({ ...member, query: {} })).status,
	).toBe(404);
	expect((await api.api.funds.cases.get(member)).data).toEqual([]);
	expect(
		(await endpoint.import.post({ files: [statement()] }, member)).status,
	).toBe(404);
	expect(
		(await api.api.funds.cases.get({ headers: { cookie: "" } })).status,
	).toBe(401);
	expect(
		(
			await api.api.funds.cases.post(
				{ name: "拒绝" },
				{ headers: { origin: "https://bad.invalid" } },
			)
		).status,
	).toBe(403);
}, 30_000);

test("图不可用时仍保存原文，待投影版本拒绝查询，恢复后可重放", async () => {
	const id = await newCase();
	await app.stop();
	release?.();
	release = initializeServerResources({
		fundsFiles: files,
		db: database.db,
		auth,
		origins: [origin],
		trustedProxyIps: [],
	});
	app = createApp().listen({ port: 0, hostname: "127.0.0.1" });
	api = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
		headers: { origin, cookie },
	});
	const imported = await api.api.funds
		.cases({ caseId: id })
		.import.post({ files: [statement()] });
	expect((await jobResult(id, imported.data?.id))?.status).toBe("queued");
	expect(await database.db.select().from(fundsSource)).toHaveLength(1);
	expect((await api.api.funds.cases({ caseId: id }).summary.get()).status).toBe(
		409,
	);
	await app.stop();
	release?.();
	release = initializeServerResources({
		fundsFiles: files,
		db: database.db,
		auth,
		fundsGraph: graph,
		origins: [origin],
		trustedProxyIps: [],
	});
	app = createApp().listen({ port: 0, hostname: "127.0.0.1" });
	api = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
		headers: { origin, cookie },
	});
	await database.db.update(fundsJob).set({ nextRunAt: new Date(0) });
	const synced = await api.api.funds.cases({ caseId: id }).sync.post();
	expect((await jobResult(id, synced.data?.id))?.result?.graphReady).toBe(true);
	expect((await database.db.select().from(fundsCase))[0]?.graphRevision).toBe(
		1,
	);
	expect(
		(await api.api.funds.cases({ caseId: id }).summary.get()).data
			?.transactions,
	).toBe(3);
}, 30_000);

test("案件置顶与归档持久化，恢复不改变流水版本", async () => {
	const id = await newCase();
	const endpoint = api.api.funds.cases({ caseId: id });
	expect((await endpoint.patch({ pinned: true })).data?.pinned).toBe(true);
	expect((await endpoint.patch({ archived: true })).data?.archived).toBe(true);
	const saved = (await api.api.funds.cases.get()).data?.find(
		(item) => item.id === id,
	);
	expect(saved).toMatchObject({ pinned: true, archived: true, revision: 0 });
	expect(
		(await endpoint.patch({ archived: false, pinned: false })).data,
	).toMatchObject({ pinned: false, archived: false, revision: 0 });
	expect((await endpoint.patch({})).status).toBe(400);
});

test("原件在处理前可下载，worker 从 RustFS 读取，哈希损坏阻止返回", async () => {
	const id = await newCase();
	const other = await newCase();
	const original = statement("原始流水.csv");
	const endpoint = api.api.funds.cases({ caseId: id });
	const upload = await endpoint.import.post({ files: [original] });
	expect(upload.status).toBe(200);
	const [row] = await database.db.select().from(fundsJobFile);
	if (!row?.fileRef) throw new Error("原件引用未保存");
	expect(row.bytesBase64).toBeNull();
	expect(row.fileRef.key.startsWith(`cases/${id}/originals/`)).toBe(true);
	const download = await endpoint
		.jobs({ jobId: row.jobId })
		.files({ fileId: row.id })
		.get({ query: { format: "original" } });
	expect(download.status).toBe(200);
	expect(download.data as unknown).toEqual(await original.arrayBuffer());
	expect(
		(
			await api.api.funds
				.cases({ caseId: other })
				.jobs({ jobId: row.jobId })
				.files({ fileId: row.id })
				.get({ query: { format: "original" } })
		).status,
	).toBe(404);
	await drainJobs();
	const [source] = await database.db.select().from(fundsSource);
	if (!source) throw new Error("来源未写入");
	expect(source.fileRef).toEqual(row.fileRef);
	expect(source.bytesBase64).toBeNull();
	const sourceDownload = await endpoint
		.sources({ sourceId: source.id })
		.original.get();
	expect(sourceDownload.data as unknown).toEqual(await original.arrayBuffer());
	expect(
		(
			await api.api.funds
				.cases({ caseId: other })
				.sources({ sourceId: source.id })
				.original.get()
		).status,
	).toBe(404);
	// 模拟损坏的测试对象，只写本测试随机桶；读取必须停止而非交付错误内容。
	await s3.send(
		new PutObjectCommand({
			Bucket: row.fileRef.bucket,
			Key: row.fileRef.key,
			Body: "corrupt",
		}),
	);
	expect(
		(await endpoint.sources({ sourceId: source.id }).original.get()).status,
	).toBe(503);
}, 30_000);

test("存储不可用时不创建任务，上传者得到明确错误", async () => {
	const id = await newCase();
	await app.stop();
	release?.();
	release = initializeServerResources({
		db: database.db,
		auth,
		fundsGraph: graph,
		origins: [origin],
		trustedProxyIps: [],
		fundsFiles: {
			...files,
			put: async () => {
				throw new Error("模拟存储不可用");
			},
		},
	});
	app = createApp().listen({ port: 0, hostname: "127.0.0.1" });
	api = treaty<App>(`http://127.0.0.1:${app.server?.port}`, {
		headers: { origin, cookie },
	});
	expect(
		(
			await api.api.funds
				.cases({ caseId: id })
				.import.post({ files: [statement()] })
		).status,
	).toBe(503);
	expect(
		await database.db.select().from(fundsJob).where(eq(fundsJob.caseId, id)),
	).toHaveLength(0);
	expect(await database.db.select().from(fundsJobFile)).toHaveLength(0);
});

test("案件移动持久化，限制同分组，删除案件不再出现在任何业务入口", async () => {
	const a = await newCase();
	const b = await newCase();
	const c = await newCase();
	const endpoint = api.api.funds.cases({ caseId: a });
	expect(
		(await endpoint.move.post({ targetId: c, placement: "before" })).status,
	).toBe(200);
	expect((await api.api.funds.cases.get()).data?.map((r) => r.id)).toEqual([
		a,
		c,
		b,
	]);
	await api.api.funds.cases({ caseId: c }).patch({ pinned: true });
	expect(
		(await endpoint.move.post({ targetId: c, placement: "after" })).status,
	).toBe(409);
	expect(
		(
			await endpoint.move.post({
				targetId: crypto.randomUUID(),
				placement: "after",
			})
		).status,
	).toBe(404);
	expect((await endpoint.delete()).status).toBe(409);
	const upload = await endpoint.import.post({ files: [statement()] });
	await drainJobs();
	const [source] = await database.db
		.select()
		.from(fundsSource)
		.where(eq(fundsSource.caseId, a));
	if (!source?.fileRef) throw new Error("测试来源缺失");
	const priorGraph = await graph.summary(a);
	const before = await database.db
		.select()
		.from(fundsRevision)
		.where(eq(fundsRevision.caseId, a));
	const sync = await endpoint.sync.post();
	await endpoint.patch({ archived: true });
	expect((await endpoint.delete()).status).toBe(200);
	const [saved] = await database.db
		.select()
		.from(fundsCase)
		.where(eq(fundsCase.id, a));
	expect(saved?.deletedAt).toBeInstanceOf(Date);
	expect(saved?.deletedBy).toBeTruthy();
	expect((await api.api.funds.cases.get()).data?.some((r) => r.id === a)).toBe(
		false,
	);
	expect((await endpoint.get()).status).toBe(404);
	expect((await endpoint.patch({ archived: false })).status).toBe(404);
	expect((await endpoint.delete()).status).toBe(404);
	expect((await endpoint.summary.get()).status).toBe(404);
	expect((await endpoint.graph.get()).status).toBe(404);
	expect((await endpoint.export.get()).status).toBe(404);
	expect(
		(await endpoint.sources({ sourceId: source.id }).original.get()).status,
	).toBe(404);
	expect((await endpoint.import.post({ files: [statement()] })).status).toBe(
		404,
	);
	expect((await endpoint.jobs.get()).status).toBe(404);
	expect(
		(await endpoint.jobs({ jobId: sync.data?.id ?? "" }).retry.post()).status,
	).toBe(404);
	expect(
		(await endpoint.move.post({ targetId: b, placement: "after" })).status,
	).toBe(404);
	expect(
		(await api.api.funds.cases({ caseId: b }).links.get()).data?.matches.some(
			(r) => r.originCaseId === a,
		),
	).toBe(false);
	expect(
		await database.db
			.select()
			.from(fundsRevision)
			.where(eq(fundsRevision.caseId, a)),
	).toEqual(before);
	expect(await graph.summary(a)).toEqual(priorGraph);
	expect(await files.read(a, source.fileRef)).toEqual(
		new Uint8Array(await statement().arrayBuffer()),
	);
	const jobs = await database.db
		.select()
		.from(fundsJob)
		.where(eq(fundsJob.caseId, a));
	expect(jobs.find((j) => j.id === sync.data?.id)?.status).toBe("cancelled");
	expect(jobs.find((j) => j.id === upload.data?.id)?.status).toBe("completed");
	await drainJobs();
	expect(await graph.summary(a)).toEqual(priorGraph);
}, 30_000);

test("Worker 自动识别多卡主体；拆分、软撤销与重识别保留全部账户、交易和证据", async () => {
	const id = await newCase();
	const endpoint = api.api.funds.cases({ caseId: id });
	const file = new File(
		[
			"本方账号,本方户名,对方账号,对方户名,借贷方向,交易时间,交易金额,交易流水号\n10001,赵佳,20001,周明,借,2022-01-05 10:00:00,100.00,one\n10002,赵佳,20001,周明,借,2022-01-05 11:00:00,60.00,two\n20001,周明,10002,赵佳,借,2022-01-05 12:00:00,30.00,three\n10001,赵佳,10002,赵佳,借,2022-01-05 13:00:00,20.00,four\n",
		],
		"multi-card.csv",
	);
	const upload = await endpoint.import.post({ files: [file] });
	const completed = await jobResult(id, upload.data?.id);
	expect(completed?.status).toBe("completed");
	expect(completed?.result?.subjectSummary.mergedGroups).toBe(1);
	const grouped = await endpoint.graph.get();
	expect(grouped.data?.nodes).toHaveLength(2);
	expect(grouped.data?.edges).toHaveLength(4);
	const zhao = grouped.data?.nodes.find((n) => n.names.includes("赵佳"));
	expect(zhao?.accounts.map((a) => a.number).sort()).toEqual([
		"10001",
		"10002",
	]);
	expect(zhao?.identityStatus).toBe("name-inferred");
	expect(
		grouped.data?.edges.some(
			(t) => t.from === t.to && t.fromAccount !== t.toAccount,
		),
	).toBe(true);
	const ids = grouped.data?.edges.map((t) => t.id).sort();
	const first = grouped.data?.edges.find((t) => t.amountMinor === "10000");
	if (!first) throw new Error("缺少起点");
	const trace = await endpoint.trace.post({
		account: "10001",
		transaction: first.id,
		depth: 4,
		from: "",
		to: "",
	});
	// 返回赵佳另一张卡后不能凭“同一人”跳去第一张卡的内部付款。
	expect(trace.data?.edges.map((t) => t.amountMinor).sort()).toEqual([
		"10000",
		"3000",
	]);
	expect(
		(
			await endpoint.subjects.post({
				revision: 1,
				action: "separate",
				accounts: ["10001", "not-this-case"],
			})
		).status,
	).toBe(400);
	expect(
		(
			await endpoint.subjects.post({
				revision: 1,
				action: "separate",
				accounts: ["10001", "10002"],
			})
		).status,
	).toBe(200);
	expect(
		(
			await endpoint.subjects.post({
				revision: 1,
				action: "merge",
				accounts: ["10001", "10002"],
			})
		).status,
	).toBe(409);
	await drainJobs();
	expect((await endpoint.graph.get()).data?.nodes).toHaveLength(3);
	expect(
		(await endpoint.graph.get()).data?.edges.map((t) => t.id).sort(),
	).toEqual(ids);
	const decision = (await endpoint.subjects.get()).data?.overrides[0];
	if (!decision) throw new Error("缺少更正记录");
	expect(
		(
			await endpoint
				.subjects({ overrideId: decision.id })
				.delete({ revision: 2 })
		).status,
	).toBe(200);
	await drainJobs();
	expect(
		(await endpoint.subjects.get()).data?.overrides[0]?.deletedAt,
	).toBeTruthy();
	expect((await endpoint.graph.get()).data?.nodes).toHaveLength(2);
	const scan = await endpoint.subjects.scan.post();
	await jobResult(id, scan.data?.id);
	expect((await endpoint.get()).data?.revision).toBe(4);
	if (!scan.data?.id) throw new Error("缺少任务");
	await database.db
		.update(fundsJob)
		.set({
			status: "queued",
			stage: "queued",
			leaseOwner: null,
			leaseUntil: null,
		})
		.where(eq(fundsJob.id, scan.data.id));
	await drainJobs();
	expect((await endpoint.get()).data?.revision).toBe(4);
	expect(
		(await endpoint.graph.get()).data?.edges.map((t) => t.id).sort(),
	).toEqual(ids);
	expect(
		(await endpoint.evidence({ transactionId: first.id }).get()).status,
	).toBe(200);
	const merged = await endpoint.subjects.post({
		revision: 4,
		action: "merge",
		accounts: ["10001", "10002"],
		name: "赵佳（人工确认）",
	});
	expect(merged.status).toBe(200);
	await drainJobs();
	const manual = (await endpoint.graph.get()).data?.nodes.find(
		(n) => n.identityStatus === "manual",
	);
	expect(manual?.names).toEqual(["赵佳（人工确认）"]);
	expect(manual?.accountNumbers.sort()).toEqual(["10001", "10002"]);
	expect(
		(await endpoint.graph.get()).data?.edges.map((t) => t.id).sort(),
	).toEqual(ids);
	const repeat = await endpoint.import.post({ files: [file] });
	await jobResult(id, repeat.data?.id);
	expect((await endpoint.get()).data?.revision).toBe(5);
	expect(
		(await endpoint.subjects.get()).data?.overrides.filter((o) => !o.deletedAt),
	).toHaveLength(1);
	const other = api.api.funds.cases({ caseId: await newCase() });
	expect((await other.subjects.get()).data?.groups).toHaveLength(0);
	expect(
		(await other.subjects({ overrideId: decision.id }).delete({ revision: 0 }))
			.status,
	).toBe(404);
}, 30_000);
