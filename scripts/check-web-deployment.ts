/**
 * @file 生产构建的深层地址资源检查。
 * 创建时间：2026-10-04（本次新建）；修改时间：2026-10-04。
 * 版本作用：防止 history fallback 掩盖错误资源地址；被调用：test:deploy。
 * 调用：Vite preview、HTTP fetch；功能：校验深层入口的 JS/CSS MIME。
 * 预期结果：根部署和指定子路径均可直接加载；结束后关闭自己的预览进程。
 */
import { resolve } from "node:path";

const web = resolve(import.meta.dir, "../apps/web");
const base = process.argv[2] ?? "/";
const outDir = resolve(process.argv[3] ?? resolve(web, "dist"));
if (!base.startsWith("/") || !base.endsWith("/"))
	throw new Error("部署前缀必须以 / 开始和结束。");
const reservation = Bun.serve({
	port: 0,
	hostname: "127.0.0.1",
	fetch: () => new Response(),
});
const port = reservation.port;
await reservation.stop(true);
const preview = Bun.spawn({
	cmd: [
		process.execPath,
		"--bun",
		resolve(web, "node_modules/vite/bin/vite.js"),
		"preview",
		"--host",
		"127.0.0.1",
		"--port",
		String(port),
		"--strictPort",
		"--base",
		base,
		"--outDir",
		outDir,
	],
	cwd: web,
	stdout: "pipe",
	stderr: "pipe",
});
const origin = `http://127.0.0.1:${port}`;
try {
	let ready = false;
	for (let attempt = 0; attempt < 50; attempt++) {
		if (preview.exitCode !== null)
			throw new Error(await new Response(preview.stderr).text());
		try {
			ready = (
				await fetch(`${origin}${base}`, { signal: AbortSignal.timeout(500) })
			).ok;
		} catch {
			/* 预览尚未开始监听。 */
		}
		if (ready) break;
		await Bun.sleep(100);
	}
	if (!ready) throw new Error("生产预览启动超时。");
	for (const path of [
		"login",
		"settings/general",
		"knowledge-base/collections",
	]) {
		const url = `${origin}${base}${path}`;
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`深层入口返回 ${response.status}: ${path}`);
		const html = await response.text();
		const assets = [
			...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
		].map((match) => match[1]);
		if (!assets.length) throw new Error(`入口没有 JS/CSS: ${path}`);
		for (const asset of assets) {
			if (!asset) continue;
			const assetUrl = new URL(asset, url);
			const result = await fetch(assetUrl);
			const contentType = result.headers.get("content-type") ?? "";
			if (
				!result.ok ||
				!(asset.endsWith(".css")
					? contentType.includes("text/css")
					: /(?:java|ecma)script/.test(contentType))
			)
				throw new Error(
					`生产资源路径或 MIME 错误: ${assetUrl.pathname} (${result.status}, ${contentType})`,
				);
		}
	}
	console.info(`生产深层入口通过：${base}（JS/CSS 状态与 MIME 正确）。`);
} finally {
	preview.kill();
	await preview.exited;
}
