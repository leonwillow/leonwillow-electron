/**
 * @file 桌面地址持久化的真实临时文件回归。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：Bun test；功能：验证默认、覆盖、重启恢复、重置与损坏文件回退。
 */
import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnectionStore } from "../src/connection-store";

test("自定义地址独立保存、重启回读，恢复默认不保存凭据", async () => {
	const directory = await mkdtemp(join(tmpdir(), "aidesk-connection-"));
	const file = join(directory, "server.json");
	try {
		const store = await createConnectionStore(file, "http://localhost:3000");
		expect(store.status()).toEqual({
			defaultUrl: "http://localhost:3000",
			customUrl: null,
			effectiveUrl: "http://localhost:3000",
		});
		await store.save({ address: "https://api.example.com", port: "8443" });
		expect(
			(await createConnectionStore(file, "http://localhost:3000")).status()
				.effectiveUrl,
		).toBe("https://api.example.com:8443");
		expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
			version: 1,
			customUrl: "https://api.example.com:8443",
		});
		await store.save(null);
		expect(
			(await createConnectionStore(file, "http://localhost:3000")).status()
				.customUrl,
		).toBeNull();
		await writeFile(file, "{bad JSON");
		const recovered = await createConnectionStore(
			file,
			"http://localhost:3000",
		);
		expect(recovered.status().effectiveUrl).toBe("http://localhost:3000");
		expect(recovered.status().warning).toBeTruthy();
		await recovered.save(null);
		expect(recovered.status().warning).toBeUndefined();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
