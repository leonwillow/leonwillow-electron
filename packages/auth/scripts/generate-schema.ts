/**
 * @file 固定版本认证生成器到 Drizzle 1.0 表定义的适配入口。
 * 创建时间：2026-10-04（本次新建）
 * 修改时间：2026-10-04
 * 版本作用：隔离上游生成内容与手写关系，保证再次生成可重复。
 * 被调用：auth 的 schema:generate；调用：auth CLI、TypeScript AST、Biome。
 * 功能：在临时目录生成，移除旧关系 API，再覆盖唯一生成目标。
 * 预期结果：只更新 schema/auth.ts；生成失败不覆盖现有表定义。
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

const cwd = resolve(import.meta.dir, "..");
const target = resolve(cwd, "../db/src/schema/auth.ts");
const temporary = await mkdtemp(join(tmpdir(), "leonwillow-auth-schema-"));
const generated = join(temporary, "auth.ts");

try {
	const result = Bun.spawnSync({
		cmd: [
			process.execPath,
			"run",
			"--bun",
			"auth",
			"generate",
			"--config",
			"./src/cli.ts",
			"--adapter",
			"drizzle",
			"--dialect",
			"postgresql",
			"--output",
			generated,
			"--yes",
		],
		cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	if (result.exitCode !== 0)
		throw new Error("认证 schema 生成失败，现有文件未覆盖。");
	const source = ts.createSourceFile(
		generated,
		await readFile(generated, "utf8"),
		ts.ScriptTarget.Latest,
		true,
	);
	let relationImports = 0;
	let relations = 0;
	const statements = source.statements.filter((statement) => {
		if (
			ts.isImportDeclaration(statement) &&
			ts.isStringLiteral(statement.moduleSpecifier) &&
			statement.moduleSpecifier.text === "drizzle-orm"
		) {
			const bindings = statement.importClause?.namedBindings;
			if (
				!bindings ||
				!ts.isNamedImports(bindings) ||
				bindings.elements.length !== 1 ||
				bindings.elements[0]?.name.text !== "relations"
			) {
				throw new Error("上游 Drizzle 导入已变化，请审查生成适配器。");
			}
			relationImports++;
			return false;
		}
		if (
			ts.isVariableStatement(statement) &&
			statement.declarationList.declarations.length === 1
		) {
			const initializer =
				statement.declarationList.declarations[0]?.initializer;
			if (
				initializer &&
				ts.isCallExpression(initializer) &&
				ts.isIdentifier(initializer.expression) &&
				initializer.expression.text === "relations"
			) {
				relations++;
				return false;
			}
		}
		return true;
	});
	if (relationImports !== 1 || relations !== 3)
		throw new Error(
			"上游关系结构已变化，请审查手写 relations.ts 后更新生成适配器。",
		);
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	const output =
		"/** @generated 由 bun run auth:schema 生成；表定义来自 auth@1.7.5，手写关系见 ../relations.ts。禁止手工修改。 */\n" +
		statements
			.map((statement) =>
				printer.printNode(ts.EmitHint.Unspecified, statement, source),
			)
			.join("\n");
	await writeFile(generated, output);
	const formatted = Bun.spawnSync({
		cmd: [
			process.execPath,
			"--bun",
			resolve(cwd, "../../node_modules/.bin/biome"),
			"check",
			"--write",
			"--stdin-file-path",
			target,
		],
		cwd: resolve(cwd, "../.."),
		stdin: Buffer.from(output),
	});
	if (formatted.exitCode !== 0)
		throw new Error(new TextDecoder().decode(formatted.stderr));
	await writeFile(target, formatted.stdout);
	console.info("认证表已生成；手写关系和迁移历史保持独立。");
} finally {
	await rm(temporary, { recursive: true, force: true });
}
