import "varlock/auto-load";
import { createApp } from "./app";
import { ENV } from "./env";

const app = createApp(ENV.CORS_ORIGIN).listen(ENV.PORT);
console.info("API 已启动，端口：", app.server?.port);
