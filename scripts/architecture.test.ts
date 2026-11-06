/**
 * @file 工作区导入边界与包出口的回归测试。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-11-05
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、node:fs、node:path、server、@elysiajs/eden、next-themes、@leonwillow-electron/auth、@leonwillow-electron/db、../../../server/src/app、../../../../packages/auth/src/config、../../../../packages/db/src/env、electron、next。
 * 功能：通过真实 Biome 路径检查越界导入，并验证运行时包解析。
 * 预期结果：浏览器不能引入后端运行时；临时样例在测试结束时清理。
 */
import { expect, test } from "bun:test";
import { unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

function lintImport(source: string, file = "apps/web/src/boundary-fixture.ts") {
	// 使用真实路径验证 includes 和 override；测试后只清理自身创建的文件。
	const fixture = resolve(
		root,
		file.replace(/\.ts$/, `-${crypto.randomUUID()}.ts`),
	);
	writeFileSync(fixture, `${source}\n`);
	try {
		const result = Bun.spawnSync({
			cmd: [
				process.execPath,
				"x",
				"--bun",
				"biome",
				"lint",
				"--only=style/noRestrictedImports",
				fixture,
			],
			cwd: root,
		});
		return {
			code: result.exitCode,
			output: new TextDecoder().decode(result.stderr),
		};
	} finally {
		unlinkSync(fixture);
	}
}

test("Eden 类型契约、客户端依赖和现有主题库可以进入浏览器", () => {
	expect(
		lintImport(`import type { App } from "server/app";
import { treaty } from "@elysiajs/eden";
import { useTheme } from "next-themes";
export const api = treaty<App>("http://localhost:3000");
export { useTheme };`).code,
	).toBe(0);
});

test("构建配置仍可使用 Node API", () => {
	expect(
		lintImport(
			'import { resolve } from "node:path"; export { resolve };',
			"apps/web/vite.config.ts",
		).code,
	).toBe(0);
});

for (const source of [
	'import { createApp } from "server/app";',
	'import { createApp as createClient } from "server/app";',
	'const auth = import("@leonwillow-electron/auth");',
	'export { createDatabase } from "@leonwillow-electron/db";',
	'import { createApp } from "../../../server/src/app";',
	'import { authOptions } from "../../../../packages/auth/src/config";',
	'import { ENV } from "../../../../packages/db/src/env";',
	'import { readFile } from "node:fs/promises";',
	'import { BrowserWindow } from "electron";',
	'import Link from "next/link";',
]) {
	test(`浏览器与共享 UI 拒绝越界依赖：${source}`, () => {
		for (const file of [
			"apps/web/src/boundary-fixture.ts",
			"packages/ui/src/boundary-fixture.ts",
			"packages/lattice-grid/src/boundary-fixture.ts",
		]) {
			const result = lintImport(source, file);
			expect(result.code).toBe(1);
			expect(result.output).toContain("lint/style/noRestrictedImports");
		}
	});
}

test("包出口在运行时拒绝契约、CLI 配置和数据库环境", () => {
	for (const name of [
		"server/app",
		"@leonwillow-electron/auth/config",
		"@leonwillow-electron/auth/cli",
		"@leonwillow-electron/db/env",
	]) {
		expect(() => Bun.resolveSync(name, resolve(root, "apps/web"))).toThrow();
	}
	for (const name of [
		"@leonwillow-electron/auth",
		"@leonwillow-electron/auth/bootstrap",
		"@leonwillow-electron/db/schema",
	]) {
		expect(Bun.resolveSync(name, resolve(root, "apps/server"))).toContain(
			"/packages/",
		);
	}
});
