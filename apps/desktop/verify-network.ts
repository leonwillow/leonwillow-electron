/**
 * @file Electron原生网络回归的Bun启动器。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：test:electron；功能：打包无UI测试入口并等待Electron完成真实Cookie网络验证。
 */
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import electron from "electron";

await mkdir(join(import.meta.dir, "dist"), { recursive: true });
const result = await Bun.build({
	entrypoints: [join(import.meta.dir, "test/electron-network.fixture.ts")],
	outdir: join(import.meta.dir, "dist"),
	naming: "verify-network.cjs",
	target: "node",
	format: "cjs",
	external: ["electron"],
});
if (!result.success)
	throw new AggregateError(result.logs, "Electron网络测试构建失败");
const directory = await mkdtemp(join(tmpdir(), "aidesk-electron-network-"));
try {
	for (const phase of ["save", "restore"]) {
		const child = Bun.spawn(
			[
				String(electron),
				join(import.meta.dir, "dist/verify-network.cjs"),
				directory,
				phase,
			],
			{ stdout: "inherit", stderr: "inherit" },
		);
		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, 45_000);
		const code = await child.exited;
		clearTimeout(timeout);
		if (timedOut || code)
			throw new Error(
				timedOut ? "Electron网络测试超时" : `Electron网络测试退出码：${code}`,
			);
	}
} finally {
	await rm(directory, { recursive: true, force: true });
}
