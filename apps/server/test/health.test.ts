/**
 * @file 公共接口与认证模块隔离的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-11-21
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、@elysiajs/eden、../src/app。
 * 功能：用 Eden 检查健康响应、CORS、来源限制和未配置认证的行为。
 * 预期结果：不启动数据库也能验证公共路由正常工作。
 */
import { expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { Elysia } from "elysia";
import { createApp } from "../src/app";
import { DocumentsModel } from "../src/modules/documents/model";
import { InquiriesModel } from "../src/modules/inquiries/model";

test("畸形 JSON 返回 400，字段校验失败返回 422", async () => {
	for (const [body, expected] of [
		["{", 400],
		["{}", 422],
	] as const) {
		const response = await createApp().handle(
			new Request("http://localhost/api/auth/login", {
				method: "POST",
				headers: {
					origin: "http://localhost:3001",
					"content-type": "application/json",
				},
				body,
			}),
		);
		expect(response.status).toBe(expected);
		expect(response.headers.get("x-request-id")).toBeTruthy();
	}
});

test("Eden 可以通过共享契约访问健康检查", async () => {
	const api = treaty(createApp());
	const { data, error, status } = await api.api.health.get();
	expect(status).toBe(200);
	expect(error).toBeNull();
	expect(data).toEqual({ status: "ok", service: "leonwillow-electron" });
});

test("健康检查允许 Web renderer 跨域访问", async () => {
	const response = await createApp().handle(
		new Request("http://localhost/api/health", {
			headers: { origin: "http://localhost:3001" },
		}),
	);
	expect(response.headers.get("access-control-allow-origin")).toBe(
		"http://localhost:3001",
	);
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(response.headers.get("x-frame-options")).toBe("DENY");
	expect(response.headers.get("referrer-policy")).toBe("no-referrer");
	const missing = await createApp().handle(
		new Request("http://localhost/api/not-found"),
	);
	expect(missing.status).toBe(404);
	expect(missing.headers.get("x-content-type-options")).toBe("nosniff");
	expect(missing.headers.get("x-frame-options")).toBe("DENY");
	expect(missing.headers.get("referrer-policy")).toBe("no-referrer");
});

test("缺少认证配置时返回 503，认证和权限插件不影响后续公共路由", async () => {
	const origin = "http://localhost:3001";
	const api = treaty(
		createApp().get("/api/public", () => ({ public: true })),
		{ headers: { origin } },
	);
	const session = await api.api.auth.session.get();
	expect(session.status).toBe(503);
	expect(session.error?.value).toMatchObject({ code: "AUTH_UNAVAILABLE" });
	for (const result of [
		await api.api.access.get(),
		await api.api.admin.users.get(),
	]) {
		expect(result.status).toBe(503);
		expect(result.error?.value).toMatchObject({ code: "ACCESS_UNAVAILABLE" });
	}
	const denied = await api.api.auth.login.post(
		{ username: "admin", password: "admin", rememberMe: false },
		{ headers: { origin: "https://untrusted.invalid" } },
	);
	expect(denied.status).toBe(403);
	expect(denied.error?.value).toMatchObject({ code: "INVALID_ORIGIN" });
	expect((await api.api.public.get()).data).toEqual({ public: true });
	expect((await api.api.health.get()).status).toBe(200);
});

test("文书与笔录数值查询参数拒绝浮点数，仅接受整数", async () => {
	const probe = new Elysia()
		.get("/docs", ({ query }) => query, { query: DocumentsModel.list })
		.get("/inquiries", ({ query }) => query, { query: InquiriesModel.list });
	expect(
		(
			await probe.handle(
				new Request("http://localhost/docs?year=2026&offset=0&limit=20"),
			)
		).status,
	).toBe(200);
	expect(
		(await probe.handle(new Request("http://localhost/docs?year=2026.5")))
			.status,
	).toBe(422);
	expect(
		(await probe.handle(new Request("http://localhost/docs?offset=1.5")))
			.status,
	).toBe(422);
	expect(
		(await probe.handle(new Request("http://localhost/inquiries?limit=10.5")))
			.status,
	).toBe(422);
	expect(
		(await probe.handle(new Request("http://localhost/inquiries?offset=2.2")))
			.status,
	).toBe(422);
});
