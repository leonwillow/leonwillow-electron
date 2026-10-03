import { treaty } from "@elysiajs/eden";
import type { App } from "server/app";
import { ENV } from "@/env";

// 类型导入会在打包时移除；Web/Electron renderer 共用 Eden 客户端。
// 本阶段布局不调用 API。
export const api = treaty<App>(ENV.VITE_SERVER_URL);
