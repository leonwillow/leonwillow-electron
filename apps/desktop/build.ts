/**
 * @file 用 Bun 打包 Electron 主进程并复制同一份 Web 产物。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：desktop build；调用：Bun.build、Node fs、desktop-bridge。
 * 功能：生成无运行时业务依赖的 CJS 入口，只写入公开默认服务器地址。
 * 预期结果：Turbo 先构建 web；桌面运行不依赖 Vite、Bun 或独立前端服务器。
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	connectionInput,
	normalizeConnection,
} from "@leonwillow-electron/desktop-bridge";

const root = import.meta.dir;
const web = join(root, "../web");
let configured = "http://localhost:3000";
// 与 Vite production 的文件优先级一致；仅提取公开 URL，不复制其他配置或密钥。
for (const name of [
	".env.schema",
	".env",
	".env.local",
	".env.production",
	".env.production.local",
]) {
	try {
		const text = await readFile(join(web, name), "utf8");
		const value = text.match(
			/^\s*(?:export\s+)?VITE_SERVER_URL\s*=\s*(.*?)\s*$/m,
		)?.[1];
		if (value)
			configured = value.replace(/^(['"])(.*)\1$/, "$2").replace(/\s+#.*$/, "");
	} catch (error) {
		if (
			!(
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			)
		)
			throw error;
	}
}
const defaultUrl = normalizeConnection(
	connectionInput(process.env.VITE_SERVER_URL ?? configured),
);
await mkdir(join(root, "dist"), { recursive: true });
for (const name of ["main", "preload"]) {
	const result = await Bun.build({
		entrypoints: [join(root, `src/${name}.ts`)],
		outdir: join(root, "dist"),
		naming: `${name}.cjs`,
		target: "node",
		format: "cjs",
		external: ["electron"],
	});
	if (!result.success)
		throw new AggregateError(result.logs, "桌面入口构建失败");
}
await rm(join(root, "dist/renderer"), { recursive: true, force: true });
await cp(join(web, "dist"), join(root, "dist/renderer"), { recursive: true });
await writeFile(join(root, "dist/config.json"), JSON.stringify({ defaultUrl }));
console.info("桌面入口与共用 Web 产物已生成。");
