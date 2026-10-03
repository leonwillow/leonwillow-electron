import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

// 独立于监听和环境加载，Eden 可直接使用该实例进行轻量测试。
export const createApp = (origin = "http://localhost:3001") =>
	new Elysia()
		.use(cors({ origin }))
		.get(
			"/api/health",
			() => ({ status: "ok", service: "leonwillow-electron" }) as const,
		);

export type App = ReturnType<typeof createApp>;
