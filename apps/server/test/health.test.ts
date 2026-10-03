import { expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createApp } from "../src/app";

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
});
