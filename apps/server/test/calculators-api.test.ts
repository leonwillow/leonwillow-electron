/**
 * @file 计算器 API 的真实 PostgreSQL 事务与权限回归。
 * 创建时间：2026-11-05；修改时间：2026-11-08。
 * 版本作用：独立随机 schema 跑生成迁移，验证整数结果落库、原始申报校正及并发保护。
 * 被调用：test:api；调用：Better Auth、Eden、Drizzle；结束仅清理本测试 schema。
 * 预期结果：权限、所有者、冲突、重试与失败原子性均得到验证。
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createAuth } from "@leonwillow-electron/auth";
import { initializeAdmin } from "@leonwillow-electron/auth/bootstrap";
import {
	adjustmentFields,
	emptyAdjustment,
	insertVatRows,
	LEGACY_RULES_VERSION,
	normalizeHistory,
	RULES_VERSION,
	reportingPeriodDates,
} from "@leonwillow-electron/calculators";
import { createDatabase } from "@leonwillow-electron/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { type App, createApp } from "../src/app";
import { initializeServerResources } from "../src/server-resources";

const origin = "http://localhost:3002";
const password = "vat-integration-test-password";
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
	schema = `vat_test_${crypto.randomUUID().replaceAll("-", "")}`;
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
async function member(username: string, granted = true) {
	const result = await api.api.admin.users.post(
		{
			username,
			name: username,
			role: "user",
			password,
			moduleIds: granted ? ["calculators"] : [],
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

const input = {
	name: "测试测算",
	source: "合成测试",
	history: [
		{ month: "2025-01", x: "100", i: "150", t: "0", tax: "0", end: "50" },
		{ month: "2025-02", x: "100", i: "20", t: "0", tax: "30", end: "0" },
	],
	adjustments: { "2025-01": { dx: "0", di: "100" } },
};
async function create() {
	const result = await api.api.calculators.vat.post(
		{ name: "测试测算", requestId: crypto.randomUUID() },
		headers(),
	);
	expect(result.status).toBe(200);
	if (!result.data) throw Error("创建失败");
	return result.data;
}

test("完整快照删除申报与调整后重读不复活，支持恢复和清空，旧修订拒绝", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const saved = await route.put({ ...input, revision: 1 }, headers());
	expect(saved.status).toBe(200);
	if (!saved.data) throw Error("保存失败");
	const snapshot = {
		name: saved.data.name,
		source: saved.data.source,
		history: saved.data.history,
		adjustments: saved.data.adjustments,
	};
	const removed = await route.put(
		{
			...snapshot,
			revision: 2,
			replaceHistory: true,
			history: snapshot.history.slice(1),
			adjustments: {},
		},
		headers(),
	);
	expect(removed.status).toBe(200);
	expect(
		(await route.get(headers())).data?.history.map((row) => row.id),
	).toEqual(["2025-02"]);
	expect(removed.data?.adjustments).toEqual({});
	expect(
		(
			await route.put(
				{ ...snapshot, revision: 2, replaceHistory: true },
				headers(),
			)
		).status,
	).toBe(409);
	const restored = await route.put(
		{ ...snapshot, revision: 3, replaceHistory: true },
		headers(),
	);
	expect(restored.status).toBe(200);
	expect(restored.data?.history).toEqual(snapshot.history);
	expect(restored.data?.adjustments).toEqual(snapshot.adjustments);
	const invalid = await route.put(
		{ ...snapshot, revision: 4, replaceHistory: true, history: [] },
		headers(),
	);
	expect(invalid.status).toBe(400);
	expect((await route.get(headers())).data?.revision).toBe(4);
	const empty = await route.put(
		{
			...snapshot,
			revision: 4,
			replaceHistory: true,
			history: [],
			adjustments: {},
		},
		headers(),
	);
	expect(empty.status).toBe(200);
	expect((await route.get(headers())).data?.history).toEqual([]);
	expect(empty.data?.result.rows).toEqual([]);
});

test("月报季报衔接保存重读，交叉期间被服务端原子拒绝", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const periods = [
		{ cycle: "monthly", year: 2026, index: 1 },
		{ cycle: "monthly", year: 2026, index: 2 },
		{ cycle: "monthly", year: 2026, index: 3 },
		{ cycle: "quarterly", year: 2026, index: 2 },
	] as const;
	const history = normalizeHistory(
		periods.map((period, index) => ({
			id: `period-${index}`,
			...reportingPeriodDates(period),
			x: "100",
			i: "50",
			t: "0",
			tax: "50",
			end: "0",
		})),
	);
	const snapshot = {
		name: "月季衔接",
		source: "合成测试",
		history,
		adjustments: {},
		replaceHistory: true,
	};
	const saved = await route.put({ ...snapshot, revision: 1 }, headers());
	expect(saved.status).toBe(200);
	expect(saved.data?.result.allReady).toBe(true);
	expect(saved.data?.result.totals.newTax).toBe(20000);
	expect((await route.get(headers())).data?.history).toEqual(history);
	const overlap = await route.put(
		{
			...snapshot,
			revision: 2,
			history: history.map((row, index) =>
				index === 3
					? {
							...row,
							...reportingPeriodDates({
								cycle: "quarterly",
								year: 2026,
								index: 1,
							}),
						}
					: row,
			),
		},
		headers(),
	);
	expect(overlap.status).toBe(400);
	expect((await route.get(headers())).data).toEqual(saved.data);
});

test("空行按位置落库，所属期两端分步保存，季度计算与调整始终跟随行 ID", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const base = {
		source: "所属期合成测试",
		history: normalizeHistory([
			{
				id: "q1",
				periodStart: "2025-01-01",
				periodEnd: "2025-03-31",
				x: "100",
				i: "50",
				t: "0",
				tax: "50",
				end: "0",
			},
		]),
		adjustments: { q1: { ...emptyAdjustment(), inputIncrease: "60" } },
	};
	const blank = insertVatRows(base, "q1", "below", ["new-row"]);
	const saved = await route.put(
		{ ...blank, name: "期间测试", revision: 1 },
		headers(),
	);
	expect(saved.status).toBe(200);
	expect(saved.data?.history.map((r) => r.id)).toEqual(["q1", "new-row"]);
	expect(saved.data?.history[1]).toMatchObject({
		periodStart: "",
		periodEnd: "",
	});
	expect(saved.data?.result.allReady).toBe(false);
	expect((await route.get(headers())).data?.history).toEqual(
		saved.data?.history,
	);
	const withStart = {
		...blank,
		history: blank.history.map((r) =>
			r.id === "new-row" ? { ...r, periodStart: "2025-04-01" } : r,
		),
	};
	const partial = await route.put(
		{ ...withStart, name: "期间测试", revision: 2 },
		headers(),
	);
	expect(partial.status).toBe(200);
	expect(partial.data?.history[1]?.periodEnd).toBe("");
	const complete = {
		...withStart,
		history: withStart.history.map((r) =>
			r.id === "new-row"
				? { ...r, periodEnd: "2025-06-30", x: "100", i: "50", tax: "50" }
				: r,
		),
	};
	const final = await route.put(
		{ ...complete, name: "期间测试", revision: 3 },
		headers(),
	);
	expect(final.status).toBe(200);
	expect(final.data?.result.rows.map((r) => r.n?.tax)).toEqual([0, 4000]);
	expect(final.data?.result.audit).toBe(true);
	expect(final.data?.adjustments).toEqual(base.adjustments);
	expect(final.data?.history[1]?.id).toBe("new-row");
	const stored = (
		await database.pool.query(
			"SELECT history, rules_version FROM vat_scenario WHERE id = $1",
			[created.id],
		)
	).rows[0];
	expect(stored.history).toEqual(final.data?.history);
	expect(stored.rules_version).toBe(RULES_VERSION);

	for (const dates of [
		{ periodStart: "2025-03-31", periodEnd: "2025-06-30" },
		{ periodStart: "2025-06-30", periodEnd: "2025-04-01" },
		{ periodStart: "2025-02-29", periodEnd: "2025-06-30" },
	]) {
		const rejected = await route.put(
			{
				...complete,
				name: "期间测试",
				revision: 4,
				history: complete.history.map((r) =>
					r.id === "new-row" ? { ...r, ...dates } : r,
				),
			},
			headers(),
		);
		expect(rejected.status).toBe(400);
	}
	expect((await route.get(headers())).data).toEqual(final.data);
	expect(
		(await route.put({ ...complete, name: "旧版本", revision: 3 }, headers()))
			.status,
	).toBe(409);
});

test("完整方案保存并服务端重算，重试创建不会重复或覆盖", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const saved = await route.put({ ...input, revision: 1 }, headers());
	expect(saved.status).toBe(200);
	expect(saved.data?.result.totals).toMatchObject({
		oldTax: 3000,
		newTax: 0,
		delta: -3000,
		carryDelta: 7000,
	});
	expect(saved.data?.result.audit).toBe(true);
	const read = await route.get(headers());
	expect(read.data?.history[0]?.x).toBe("100.00");
	expect(read.data?.revision).toBe(2);
	const retry = await api.api.calculators.vat.post(
		{ name: "不能覆盖", requestId: created.id },
		headers(),
	);
	expect(retry.data?.revision).toBe(2);
	expect(retry.data?.name).toBe(input.name);
	const listed = await api.api.calculators.vat.get(headers());
	expect(listed.data?.scenarios.some((s) => s.id === created.id)).toBe(true);
	expect(listed.data?.scenarios[0]).not.toHaveProperty("history");
});
test("四项独立保存和重读，抵消金额不丢失且旧客户端写入统一为 v2", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const adjustments = {
		"2025-01": {
			outputIncrease: "60",
			outputDecrease: "10",
			inputIncrease: "20",
			inputDecrease: "5",
		},
		"2025-02": {
			outputIncrease: "12",
			outputDecrease: "12",
			inputIncrease: "7",
			inputDecrease: "7",
		},
	};
	const saved = await route.put(
		{ ...input, revision: 1, adjustments },
		headers(),
	);
	expect(saved.status).toBe(200);
	expect(saved.data?.adjustments).toEqual(adjustments);
	expect(saved.data?.rulesVersion).toBe(RULES_VERSION);
	expect(saved.data?.result.rows[0]).toMatchObject({
		outputIncrease: 6000,
		outputDecrease: 1000,
		inputIncrease: 2000,
		inputDecrease: 500,
		dx: 5000,
		di: 1500,
	});
	expect(saved.data?.result.totals.delta).toBe(3500);
	expect(saved.data?.result.audit).toBe(true);
	const read = await route.get(headers());
	expect(read.data?.adjustments).toEqual(adjustments);
	expect(read.data?.result).toEqual(saved.data?.result);
	const legacy = await route.put(
		{
			...input,
			revision: 2,
			adjustments: { "2025-01": { dx: "-10", di: "20" } },
		},
		headers(),
	);
	expect(legacy.status).toBe(200);
	expect(legacy.data?.adjustments["2025-01"]).toEqual({
		outputIncrease: "",
		outputDecrease: "10.00",
		inputIncrease: "20",
		inputDecrease: "",
	});
	const stored = await database.pool.query(
		"SELECT adjustments, rules_version FROM vat_scenario WHERE id = $1",
		[created.id],
	);
	expect(stored.rows[0]?.adjustments).toEqual(legacy.data?.adjustments);
	expect(stored.rows[0]?.rules_version).toBe(RULES_VERSION);
});

test("旧数据库方案读取仅内存转换重算，坏原文保留且数据库完全不写入", async () => {
	const created = await create();
	const legacyAdjustments = {
		"2025-01": { dx: "-10", di: "20" },
		"2025-02": { dx: "bad", di: "-1" },
	};
	await database.pool.query(
		"UPDATE vat_scenario SET history = $2::jsonb, adjustments = $3::jsonb, result = $4::jsonb, rules_version = $5 WHERE id = $1",
		[
			created.id,
			JSON.stringify(input.history),
			JSON.stringify(legacyAdjustments),
			JSON.stringify({ oldSnapshot: true }),
			LEGACY_RULES_VERSION,
		],
	);
	const before = (
		await database.pool.query("SELECT * FROM vat_scenario WHERE id = $1", [
			created.id,
		])
	).rows[0];
	const read = await api.api.calculators.vat({ id: created.id }).get(headers());
	expect(read.status).toBe(200);
	expect(read.data?.rulesVersion).toBe(RULES_VERSION);
	expect(read.data?.history[0]).toMatchObject({
		id: "2025-01",
		periodStart: "2025-01-01",
		periodEnd: "2025-01-31",
	});
	expect(read.data?.adjustments["2025-01"]?.outputDecrease).toBe("10.00");
	expect(read.data?.adjustments["2025-02"]?.outputIncrease).toBe("bad");
	expect(read.data?.adjustments["2025-02"]?.inputIncrease).toBe("-1");
	expect(read.data?.result.rows[1]?.fieldErrors).toHaveProperty(
		"outputIncrease",
	);
	expect(read.data?.result.rows[1]?.fieldErrors).toHaveProperty(
		"inputIncrease",
	);
	expect(read.data?.result.allReady).toBe(false);
	expect(read.data?.revision).toBe(before.revision);
	expect(new Date(read.data?.updatedAt ?? "").getTime()).toBe(
		before.updated_at.getTime(),
	);
	const after = (
		await database.pool.query("SELECT * FROM vat_scenario WHERE id = $1", [
			created.id,
		])
	).rows[0];
	expect(after).toEqual(before);
});

test("四项坏输入允许保存修正；混合新旧字段必须原子拒绝而非清理丢弃", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	let revision = 1;
	for (const key of adjustmentFields) {
		const adjustments = { "2025-01": { ...emptyAdjustment(), [key]: "-1" } };
		const saved = await route.put(
			{ ...input, revision, adjustments },
			headers(),
		);
		expect(saved.status).toBe(200);
		expect(saved.data?.adjustments).toEqual(adjustments);
		expect(saved.data?.result.rows[0]?.fieldErrors[key]).toContain(
			"不能为负数",
		);
		expect(saved.data?.result.allReady).toBe(false);
		revision++;
	}
	const before = await route.get(headers());
	for (const mixed of [
		{ ...emptyAdjustment(), outputIncrease: "5", dx: "1", di: "2" },
		{ dx: "1", di: "2", outputDecrease: "5" },
	]) {
		const response = await fetch(
			`http://127.0.0.1:${app.server?.port}/api/calculators/vat/${created.id}`,
			{
				method: "PUT",
				headers: { cookie, origin, "content-type": "application/json" },
				body: JSON.stringify({
					...input,
					revision,
					adjustments: { "2025-01": mixed },
				}),
			},
		);
		expect(response.status).toBe(422);
	}
	const after = await route.get(headers());
	expect(after.data).toEqual(before.data);
});

test("未知金额字段不能被接口清理后保存，原方案保持不变", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	await route.put({ ...input, revision: 1 }, headers());
	const before = await route.get(headers());
	for (const [entry, expectedStatus] of [
		[{ outputIncreaze: "999" }, 422],
		[{ ...emptyAdjustment(), outputIncrease: "1", outputIncreaze: "999" }, 400],
		[{ dx: "1", di: "2", dxx: "999" }, 400],
	] as const) {
		const response = await fetch(
			`http://127.0.0.1:${app.server?.port}/api/calculators/vat/${created.id}`,
			{
				method: "PUT",
				headers: { cookie, origin, "content-type": "application/json" },
				body: JSON.stringify({
					...input,
					revision: 2,
					adjustments: { "2025-01": entry },
				}),
			},
		);
		expect(response.status).toBe(expectedStatus);
		if (expectedStatus === 400)
			expect(await response.text()).toContain("未知字段");
	}
	const after = await route.get(headers());
	expect(after.data).toEqual(before.data);
});

test("旧修订、重复月份、无效历史及未知月份调整均不覆盖原方案", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	expect((await route.put({ ...input, revision: 1 }, headers())).status).toBe(
		200,
	);
	expect((await route.put({ ...input, revision: 1 }, headers())).status).toBe(
		409,
	);
	expect(
		(
			await route.put(
				{
					...input,
					revision: 2,
					history: [
						{
							month: "2025-01",
							x: "100",
							i: "150",
							t: "0",
							tax: "0",
							end: "50",
						},
						{
							...input.history[0],
							month: "2025-01",
							x: "101",
							i: "150",
							t: "0",
							tax: "0",
							end: "50",
						},
					],
				},
				headers(),
			)
		).status,
	).toBe(400);
	expect(
		(
			await route.put(
				{
					...input,
					revision: 2,
					adjustments: { "2024-01": { dx: "1", di: "0" } },
				},
				headers(),
			)
		).status,
	).toBe(400);
	const read = await route.get(headers());
	expect(read.data?.revision).toBe(2);
	expect(read.data?.history).toHaveLength(2);
	const omitted = await route.put(
		{ ...input, revision: 2, history: [], adjustments: {} },
		headers(),
	);
	expect(omitted.data?.history).toHaveLength(2);
	expect(omitted.data?.result.totals.delta).toBe(0);
});
test("缺月和输入错误允许保存但不产生完整结果；补月恢复计算", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const first = input.history[0];
	if (!first) throw Error("fixture");
	const gap = {
		...input,
		history: [
			first,
			{ month: "2025-03", x: "100", i: "20", t: "0", tax: "80", end: "0" },
		],
		adjustments: {},
	};
	const saved = await route.put({ ...gap, revision: 1 }, headers());
	expect(saved.data?.result.rows[1]?.status).toBe("gap");
	expect(saved.data?.result.totals.newTax).toBeNull();
	const fill = await route.put(
		{ ...input, revision: 2, adjustments: {} },
		headers(),
	);
	expect(fill.data?.history).toHaveLength(3);
	expect(fill.data?.result.audit).toBe(true);
	const invalid = await route.put(
		{
			...input,
			revision: 3,
			adjustments: { "2025-01": { dx: "bad", di: "-1" } },
		},
		headers(),
	);
	expect(invalid.status).toBe(200);
	expect(invalid.data?.result.allReady).toBe(false);
	expect(invalid.data?.adjustments["2025-01"]?.outputIncrease).toBe("bad");
});
test("并发旧版本保存只有一次成功", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	const results = await Promise.all([
		route.put({ ...input, revision: 1 }, headers()),
		route.put({ ...input, revision: 1, name: "并发" }, headers()),
	]);
	expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
	expect((await route.get(headers())).data?.revision).toBe(2);
});
test("会话、模块授权、所有者隔离和软删除限制", async () => {
	const created = await create();
	const stranger = await member("vat-stranger");
	const denied = await member("vat-denied", false);
	const route = api.api.calculators.vat({ id: created.id });
	expect((await api.api.calculators.vat.get()).status).toBe(401);
	expect((await api.api.calculators.vat.get(headers(denied))).status).toBe(403);
	expect((await route.get(headers(stranger))).status).toBe(404);
	expect(
		(await route.put({ ...input, revision: 1 }, headers(stranger))).status,
	).toBe(404);
	expect(
		(await api.api.calculators.vat.get(headers(stranger))).data?.scenarios,
	).toEqual([]);
	await database.pool.query(
		"UPDATE vat_scenario SET deleted_at=now() WHERE id=$1",
		[created.id],
	);
	expect((await route.get(headers())).status).toBe(404);
});

const feeInput = {
	name: "滞纳金合成测试",
	cutoff: "2026-02-25",
	liabilities: [
		{
			id: crypto.randomUUID(),
			taxType: "vat" as const,
			period: "2026年1月",
			principal: "10000",
			deadline: "2026-02-15",
			note: "合成数据",
			payments: [
				{ id: crypto.randomUUID(), date: "2026-02-20", amount: "4000" },
			],
		},
	],
};
async function createFee() {
	const response = await api.api.calculators["late-fees"].post(
		{ name: "滞纳金合成测试", requestId: crypto.randomUUID() },
		headers(),
	);
	expect(response.status).toBe(200);
	if (!response.data) throw Error("创建滞纳金方案失败");
	return response.data;
}
test("滞纳金独立方案幂等创建，分次缴款服务端重算及重读", async () => {
	const created = await createFee();
	const route = api.api.calculators["late-fees"]({ id: created.id });
	const saved = await route.put({ ...feeInput, revision: 1 }, headers());
	expect(saved.status).toBe(200);
	expect(saved.data?.result.totals).toEqual({
		principal: 1000000,
		paid: 400000,
		remaining: 600000,
		fee: 4000,
		total: 604000,
	});
	expect(saved.data?.result.rows[0]?.result?.segments).toHaveLength(2);
	expect((await route.get(headers())).data?.liabilities).toEqual(
		feeInput.liabilities,
	);
	expect((await route.get(headers())).data?.rulesVersion).toBe(
		"tax-late-fee-0.0005-v1",
	);
	const again = await api.api.calculators["late-fees"].post(
		{ name: "不得覆盖", requestId: created.id },
		headers(),
	);
	expect(again.data?.revision).toBe(2);
	expect(again.data?.name).toBe(feeInput.name);
	const list = await api.api.calculators["late-fees"].get(headers());
	expect(list.data?.scenarios.some((s) => s.id === created.id)).toBe(true);
	expect(list.data?.scenarios[0]).not.toHaveProperty("liabilities");
	expect(
		(await api.api.calculators.vat.get(headers())).data?.scenarios.some(
			(s) => s.id === created.id,
		),
	).toBe(false);
});
test("滞纳金并发修订互斥，未完成资料保留但无结果，超界结构拒绝", async () => {
	const created = await createFee();
	const route = api.api.calculators["late-fees"]({ id: created.id });
	const responses = await Promise.all([
		route.put({ ...feeInput, revision: 1 }, headers()),
		route.put({ ...feeInput, revision: 1, name: "另一窗口" }, headers()),
	]);
	expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
	const invalid = await route.put(
		{
			...feeInput,
			revision: 2,
			liabilities: feeInput.liabilities.map((row) => ({
				...row,
				principal: "-10",
			})),
		},
		headers(),
	);
	expect(invalid.status).toBe(200);
	expect(invalid.data?.result.totals).toBeNull();
	expect(invalid.data?.result.rows[0]?.error).toContain("负数");
	expect((await route.get(headers())).data?.liabilities[0]?.principal).toBe(
		"-10",
	);
	const firstLiability = feeInput.liabilities[0];
	if (!firstLiability) throw Error("fixture");
	const tooMany = await route.put(
		{
			...feeInput,
			revision: 3,
			liabilities: Array.from({ length: 51 }, () => ({
				...firstLiability,
				id: crypto.randomUUID(),
			})),
		},
		headers(),
	);
	expect(tooMany.status).toBe(422);
	expect((await route.get(headers())).data?.revision).toBe(3);
	const fixed = await route.put({ ...feeInput, revision: 3 }, headers());
	expect(fixed.data?.result.totals?.fee).toBe(4000);
});
test("滞纳金接口要求会话与模块权限，其他人员和软删除记录不可读写", async () => {
	const created = await createFee();
	const stranger = await member("fee-stranger");
	const denied = await member("fee-denied", false);
	const apiFees = api.api.calculators["late-fees"];
	const route = apiFees({ id: created.id });
	expect((await apiFees.get()).status).toBe(401);
	expect((await apiFees.get(headers(denied))).status).toBe(403);
	expect((await route.get(headers(stranger))).status).toBe(404);
	expect(
		(await route.put({ ...feeInput, revision: 1 }, headers(stranger))).status,
	).toBe(404);
	expect((await apiFees.get(headers(stranger))).data?.scenarios).toEqual([]);
	await database.pool.query(
		"UPDATE late_fee_scenario SET deleted_at=now() WHERE id=$1",
		[created.id],
	);
	expect((await route.get(headers())).status).toBe(404);
	expect(
		(await route.put({ ...feeInput, revision: 1 }, headers())).status,
	).toBe(404);
});

for (const kind of ["vat", "late-fees"] as const) {
	test(`${kind} 目录改名、归档、恢复与软删除保留资料并校验修订`, async () => {
		const collection =
			kind === "vat"
				? api.api.calculators.vat
				: api.api.calculators["late-fees"];
		const created = await collection.post(
			{ name: "目录生命周期", requestId: crypto.randomUUID() },
			headers(),
		);
		expect(created.status).toBe(200);
		if (!created.data) throw Error("创建失败");
		const id = created.data.id;
		const route = collection({ id });
		const save = (revision: number) =>
			kind === "vat"
				? api.api.calculators.vat({ id }).put({ ...input, revision }, headers())
				: api.api.calculators["late-fees"]({ id }).put(
						{
							name: "目录生命周期",
							revision,
							cutoff: "2026-01-31",
							liabilities: [],
						},
						headers(),
					);
		const saved = await save(1);
		expect(saved.status).toBe(200);
		expect((await route.patch({ revision: 2 }, headers())).status).toBe(400);
		const rename = await route.patch(
			{ revision: 2, name: "目录改名" },
			headers(),
		);
		expect(rename.data).toMatchObject({
			name: "目录改名",
			archived: false,
			revision: 3,
		});
		expect(rename.data).not.toHaveProperty("result");
		expect(
			(await route.patch({ revision: 2, archived: true }, headers())).status,
		).toBe(409);
		const archived = await route.patch(
			{ revision: 3, archived: true },
			headers(),
		);
		expect(archived.data).toMatchObject({ archived: true, revision: 4 });
		expect((await save(4)).status).toBe(409);
		const read = await route.get(headers());
		expect(read.data?.result).toEqual(saved.data?.result);
		if (
			read.data &&
			saved.data &&
			"history" in read.data &&
			"history" in saved.data
		) {
			expect(read.data.history).toEqual(saved.data.history);
			expect(read.data.adjustments).toEqual(saved.data.adjustments);
		}
		expect(
			(await collection.get(headers())).data?.scenarios.find(
				(r) => r.id === id,
			),
		).toMatchObject({ archived: true, revision: 4 });
		const restored = await route.patch(
			{ revision: 4, archived: false },
			headers(),
		);
		expect(restored.data).toMatchObject({ archived: false, revision: 5 });
		const concurrent = await Promise.all([
			route.patch({ revision: 5, name: "并发A" }, headers()),
			route.patch({ revision: 5, name: "并发B" }, headers()),
		]);
		expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
		expect((await route.delete({ revision: 5 }, headers())).status).toBe(409);
		expect((await route.delete({ revision: 6 }, headers())).status).toBe(200);
		expect((await route.get(headers())).status).toBe(404);
		expect(
			(await route.patch({ revision: 7, archived: false }, headers())).status,
		).toBe(404);
		expect((await save(7)).status).toBe(404);
		expect(
			(await collection.post({ name: "不能复活", requestId: id }, headers()))
				.status,
		).toBe(404);
		expect(
			(await collection.get(headers())).data?.scenarios.some(
				(r) => r.id === id,
			),
		).toBe(false);
		const stored = await database.pool.query(
			`SELECT deleted_at, deleted_by, name FROM ${kind === "vat" ? "vat_scenario" : "late_fee_scenario"} WHERE id = $1`,
			[id],
		);
		expect(stored.rows[0].deleted_at).not.toBeNull();
		expect(stored.rows[0].deleted_by).not.toBeNull();
	});
	test(`${kind} 目录写入拒绝他人、未授权及坏输入`, async () => {
		const collection =
			kind === "vat"
				? api.api.calculators.vat
				: api.api.calculators["late-fees"];
		const created = await collection.post(
			{ name: "所有者隔离", requestId: crypto.randomUUID() },
			headers(),
		);
		if (!created.data) throw Error("创建失败");
		const route = collection({ id: created.data.id });
		const other = await member(`${kind.replaceAll("-", "")}-directory-other`);
		const denied = await member(
			`${kind.replaceAll("-", "")}-directory-denied`,
			false,
		);
		expect(
			(await route.patch({ revision: 1, name: "他人改名" }, headers(other)))
				.status,
		).toBe(404);
		expect((await route.delete({ revision: 1 }, headers(other))).status).toBe(
			404,
		);
		expect(
			(await route.patch({ revision: 1, archived: true }, headers(denied)))
				.status,
		).toBe(403);
		expect((await route.delete({ revision: 1 }, headers(denied))).status).toBe(
			403,
		);
		expect(
			(await route.patch({ revision: 1, name: "   " }, headers())).status,
		).toBe(422);
		expect((await route.get(headers())).data).toMatchObject({
			name: "所有者隔离",
			archived: false,
			revision: 1,
		});
	});
}

test("原始申报可人工修改并落库重算，旧修订仍拒绝且遗漏月份保留", async () => {
	const created = await create();
	const route = api.api.calculators.vat({ id: created.id });
	expect((await route.put({ ...input, revision: 1 }, headers())).status).toBe(
		200,
	);
	const history = [
		{ month: "2025-01", x: "120", i: "150", t: "0", tax: "0", end: "30" },
		{ month: "2025-02", x: "100", i: "20", t: "0", tax: "50", end: "0" },
	];
	const corrected = await route.put(
		{ ...input, history, revision: 2 },
		headers(),
	);
	expect(corrected.status).toBe(200);
	expect(corrected.data?.revision).toBe(3);
	expect(corrected.data?.result.allReady).toBe(true);
	expect(corrected.data?.result.totals.oldTax).toBe(5000);
	expect(corrected.data?.result.totals.carryDelta).toBe(5000);
	expect(corrected.data?.result.audit).toBe(true);
	const read = await route.get(headers());
	expect(read.data?.history[0]?.x).toBe("120.00");
	expect(read.data?.history[1]?.tax).toBe("50.00");
	expect(read.data?.adjustments).toEqual(corrected.data?.adjustments);
	expect((await route.put({ ...input, revision: 2 }, headers())).status).toBe(
		409,
	);
	expect((await route.get(headers())).data).toEqual(read.data);
	const first = history[0];
	if (!first) throw Error("fixture");
	const invalid = await route.put(
		{ ...input, revision: 3, history: [{ ...first, tax: "-1" }] },
		headers(),
	);
	expect(invalid.status).toBe(400);
	expect((await route.get(headers())).data).toEqual(read.data);
	const partial = await route.put(
		{ ...input, revision: 3, history: [{ ...first, x: "119" }] },
		headers(),
	);
	expect(partial.status).toBe(200);
	expect(partial.data?.history).toHaveLength(2);
	expect(partial.data?.history[1]?.tax).toBe("50.00");
	expect(partial.data?.result.rows[0]?.error).toContain("反推期初留抵为负");
	expect(partial.data?.result.allReady).toBe(false);
	const repaired = await route.put(
		{ ...input, revision: 4, history },
		headers(),
	);
	expect(repaired.status).toBe(200);
	expect(repaired.data?.result.allReady).toBe(true);
});
