/**
 * @file 类 Nuxt 项目目录、命名、单向分层、纯工具边界与全局样式防污染静态门禁。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：将前后端目录白名单、跨视图隔离、lib/utils 职责边界、具名导出、Hook 命名、API 边界与单文件体积固化为自动化 lint 约束。
 * 被调用：根 lint 命令、scripts/check-conventions.test.ts。
 * 调用：node:fs、node:path、typescript。
 * 功能：扫描工作区目录结构及 TS/TSX/CSS 源码 AST，定位越界依赖、违规导出、私有逻辑外溢与膨胀文件。
 * 预期结果：任何违反目录、命名、导出或分层约定的改动在提交前以明确位置与修复建议失败退出。
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, posix, relative, resolve } from "node:path";
import ts from "typescript";

const WEB_TOP_DIRS = new Set([
	"assets",
	"components",
	"configs",
	"hooks",
	"lib",
	"routes",
	"stores",
	"styles",
	"types",
	"utils",
	"views",
]);
const WEB_TOP_FILES = new Set([
	"env.ts",
	"main.tsx",
	"routeTree.gen.ts",
	"vite-env.d.ts",
]);
const SERVER_TOP_DIRS = new Set(["modules", "scripts"]);
const SERVER_TOP_FILES = new Set([
	"app.ts",
	"auth-origins.ts",
	"env.ts",
	"funds-worker.ts",
	"index.ts",
	"lifecycle.ts",
	"server-resources.ts",
]);

const LOWER_WEB_LAYERS = new Set([
	"configs",
	"lib",
	"stores",
	"types",
	"utils",
]);
const NAMED_EXPORT_ONLY_LAYERS = new Set([
	"configs",
	"hooks",
	"lib",
	"stores",
	"utils",
]);
const FORBIDDEN_UTILS_GLOBALS = new Set([
	"document",
	"fetch",
	"localStorage",
	"sessionStorage",
	"window",
]);
const LIB_HOST_BRIDGES = new Set([
	"apps/web/src/lib/api.ts",
	"apps/web/src/lib/desktop.ts",
]);

const FORBIDDEN_GLOBALS_PREFIX =
	/\.(?:vat|late-fee|calculator|funds|inquiry|workspace|lg|desktop)-[\w-]+/;

const MAX_ROUTE_LINES = 100;
const MAX_GLOBALS_CSS_LINES = 550;
const MAX_BUSINESS_FILE_LINES = 1000;

function toPosix(filepath: string) {
	return filepath.replaceAll("\\", "/");
}

function lineNumber(source: string, position: number) {
	return source.slice(0, position).split("\n").length;
}

function resolveWebSpecifier(
	fromFile: string,
	specifier: string,
): string | null {
	if (specifier.startsWith("@/")) {
		return `apps/web/src/${specifier.slice(2)}`;
	}
	if (specifier.startsWith("./") || specifier.startsWith("../")) {
		return posix.normalize(posix.join(posix.dirname(fromFile), specifier));
	}
	return null;
}

function webLayerInfo(targetPath: string) {
	if (!targetPath.startsWith("apps/web/src/")) return null;
	const rest = targetPath.slice("apps/web/src/".length);
	const [layer = "", segment = ""] = rest.split("/");
	return { layer, segment };
}

function isPropertyNameOrTypePosition(node: ts.Identifier): boolean {
	const parent = node.parent;
	if (!parent) return false;
	if (ts.isPropertyAccessExpression(parent) && parent.name === node)
		return true;
	if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
	if (ts.isPropertySignature(parent) && parent.name === node) return true;
	if (ts.isParameter(parent) && parent.name === node) return true;
	if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
	let current: ts.Node | undefined = parent;
	while (current) {
		if (ts.isTypeNode(current) || ts.isTypeAliasDeclaration(current)) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

/**
 * 检查单个文件的文件名约定。
 * @param filename 仓库相对 POSIX 路径。
 * @returns 违规说明列表。
 */
export function checkFilenameConvention(filename: string): string[] {
	const normalized = toPosix(filename);
	if (
		normalized.endsWith("/routeTree.gen.ts") ||
		normalized.endsWith("/env.ts") ||
		normalized.startsWith("apps/web/src/routes/") ||
		normalized.startsWith("apps/web/src/assets/fonts/")
	) {
		return [];
	}
	const name = basename(normalized);
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.d|\.module)?\.[a-z0-9]+$/.test(name)) {
		return [
			`${normalized}:1 文件名 "${name}" 必须使用小写 kebab-case（仅路由文件与第三方字体资源例外）。`,
		];
	}
	return [];
}

/**
 * 检查单个 TS/TSX/CSS 源码的架构分层、命名、具名导出、纯函数边界、API 边界与体积约束。
 * @param source 文件文本。
 * @param filename 仓库相对 POSIX 路径。
 * @returns 违规说明列表。
 */
export function checkSourceConventions(
	source: string,
	filename: string,
): string[] {
	const normalized = toPosix(filename);
	const errors = checkFilenameConvention(normalized);
	if (
		normalized.endsWith("/routeTree.gen.ts") ||
		normalized.endsWith("/env.ts")
	) {
		return errors;
	}

	const lines = source.split("\n").length;

	if (normalized === "packages/ui/src/styles/globals.css") {
		if (lines > MAX_GLOBALS_CSS_LINES) {
			errors.push(
				`${normalized}:${lines} globals.css 不能超过 ${MAX_GLOBALS_CSS_LINES} 行，业务与复杂包样式请就近拆分按需加载。`,
			);
		}
		const match = FORBIDDEN_GLOBALS_PREFIX.exec(source);
		if (match && match.index !== undefined) {
			errors.push(
				`${normalized}:${lineNumber(source, match.index)} 禁止在 globals.css 声明业务或独立包选择器 "${match[0]}"，请改用 Tailwind 工具类或模块同级 CSS。`,
			);
		}
		return errors;
	}

	if (normalized.endsWith(".css")) return errors;

	if (
		normalized.startsWith("apps/web/src/routes/") &&
		lines > MAX_ROUTE_LINES
	) {
		errors.push(
			`${normalized}:${lines} 路由文件不能超过 ${MAX_ROUTE_LINES} 行，页面展示与交互必须放入 apps/web/src/views/<feature>/。`,
		);
	}

	if (
		(normalized.startsWith("apps/web/src/views/") ||
			normalized.startsWith("apps/web/src/components/") ||
			normalized.startsWith("apps/web/src/hooks/") ||
			normalized.startsWith("apps/web/src/lib/") ||
			normalized.startsWith("apps/web/src/stores/") ||
			normalized.startsWith("apps/web/src/utils/") ||
			normalized.startsWith("apps/server/src/")) &&
		lines > MAX_BUSINESS_FILE_LINES
	) {
		errors.push(
			`${normalized}:${lines} 业务源码单文件不能超过 ${MAX_BUSINESS_FILE_LINES} 行，请按子职责拆分模块。`,
		);
	}

	if (!normalized.startsWith("apps/web/src/")) return errors;

	const fromInfo = webLayerInfo(normalized);
	if (!fromInfo) return errors;

	const ast = ts.createSourceFile(
		normalized,
		source,
		ts.ScriptTarget.Latest,
		true,
		normalized.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);

	const base = basename(normalized);
	const isUseFile = base.startsWith("use-");
	const forbidDefaultExport =
		isUseFile || NAMED_EXPORT_ONLY_LAYERS.has(fromInfo.layer);

	const exportedNames: { name: string; pos: number }[] = [];
	let defaultExportPos: number | null = null;

	const checkImportEdge = (
		specifier: string,
		pos: number,
		namedImports: string[] = [],
		hasNamespaceOrDefault = false,
	) => {
		const resolved = resolveWebSpecifier(normalized, specifier);
		if (!resolved) return;
		const target = webLayerInfo(resolved);
		if (!target) return;

		if (fromInfo.layer !== "routes" && target.layer === "routes") {
			errors.push(
				`${normalized}:${lineNumber(source, pos)} 禁止非路由模块反向依赖 routes 层（"${specifier}"）。`,
			);
		} else if (fromInfo.layer === "views") {
			if (
				target.layer === "views" &&
				fromInfo.segment &&
				target.segment &&
				fromInfo.segment !== target.segment
			) {
				errors.push(
					`${normalized}:${lineNumber(source, pos)} 禁止跨业务视图私有引用 views/${target.segment}（"${specifier}"），共享能力请下沉至 components/hooks/lib/packages。`,
				);
			}
		} else if (fromInfo.layer === "components" || fromInfo.layer === "hooks") {
			if (target.layer === "views") {
				errors.push(
					`${normalized}:${lineNumber(source, pos)} 禁止 ${fromInfo.layer} 层反向依赖 views 层（"${specifier}"）。`,
				);
			}
		} else if (LOWER_WEB_LAYERS.has(fromInfo.layer)) {
			if (
				target.layer === "views" ||
				target.layer === "components" ||
				target.layer === "hooks"
			) {
				errors.push(
					`${normalized}:${lineNumber(source, pos)} 禁止底层 ${fromInfo.layer} 反向依赖上层 ${target.layer}（"${specifier}"）。`,
				);
			}
		}

		const isApiModule =
			resolved === "apps/web/src/lib/api" ||
			resolved === "apps/web/src/lib/api.ts";
		if (
			isApiModule &&
			fromInfo.layer !== "lib" &&
			(hasNamespaceOrDefault || namedImports.includes("api"))
		) {
			errors.push(
				`${normalized}:${lineNumber(source, pos)} 禁止在 apps/web/src/lib/ 之外直接引入底层 Eden api 实例，请通过 lib/<domain>.ts 封装领域请求。`,
			);
		}
	};

	const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
		ts.canHaveModifiers(node) &&
		(ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false);

	const visit = (node: ts.Node) => {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			const clause = node.importClause;
			const isTypeOnly = clause?.isTypeOnly ?? false;
			const named: string[] = [];
			let hasNsOrDefault = false;
			if (clause && !isTypeOnly) {
				if (clause.name) hasNsOrDefault = true;
				if (clause.namedBindings) {
					if (ts.isNamespaceImport(clause.namedBindings)) {
						hasNsOrDefault = true;
					} else {
						for (const el of clause.namedBindings.elements) {
							if (!el.isTypeOnly) {
								named.push((el.propertyName ?? el.name).text);
							}
						}
					}
				}
			}
			checkImportEdge(
				node.moduleSpecifier.text,
				node.moduleSpecifier.getStart(ast),
				named,
				hasNsOrDefault,
			);
		} else if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			checkImportEdge(
				node.moduleSpecifier.text,
				node.moduleSpecifier.getStart(ast),
				[],
				!node.isTypeOnly,
			);
		} else if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments[0] &&
			ts.isStringLiteralLike(node.arguments[0])
		) {
			checkImportEdge(
				node.arguments[0].text,
				node.arguments[0].getStart(ast),
				[],
				true,
			);
		}

		if (
			fromInfo.layer === "routes" &&
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "fetch"
		) {
			errors.push(
				`${normalized}:${lineNumber(source, node.getStart(ast))} 路由文件禁止直接调用 fetch，请通过 lib/<domain>.ts 的 Eden 领域客户端访问服务端。`,
			);
		}

		if (
			fromInfo.layer === "utils" &&
			ts.isIdentifier(node) &&
			FORBIDDEN_UTILS_GLOBALS.has(node.text) &&
			!isPropertyNameOrTypePosition(node)
		) {
			errors.push(
				`${normalized}:${lineNumber(source, node.getStart(ast))} utils 层只允许存放无副作用纯算法，禁止访问浏览器或网络全局对象 "${node.text}"（DOM/存储/网络适配请放入 apps/web/src/lib/）。`,
			);
		}

		if (defaultExportPos === null) {
			if (ts.isExportAssignment(node)) {
				defaultExportPos = node.getStart(ast);
			} else if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) {
				defaultExportPos = node.getStart(ast);
			} else if (
				ts.isExportDeclaration(node) &&
				node.exportClause &&
				ts.isNamedExports(node.exportClause) &&
				node.exportClause.elements.some((el) => el.name.text === "default")
			) {
				defaultExportPos = node.getStart(ast);
			}
		}

		if (
			ts.isFunctionDeclaration(node) &&
			node.name &&
			hasModifier(node, ts.SyntaxKind.ExportKeyword)
		) {
			exportedNames.push({
				name: node.name.text,
				pos: node.name.getStart(ast),
			});
		} else if (
			ts.isVariableStatement(node) &&
			hasModifier(node, ts.SyntaxKind.ExportKeyword)
		) {
			for (const decl of node.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) {
					exportedNames.push({
						name: decl.name.text,
						pos: decl.name.getStart(ast),
					});
				}
			}
		} else if (
			ts.isExportDeclaration(node) &&
			!node.moduleSpecifier &&
			node.exportClause &&
			ts.isNamedExports(node.exportClause)
		) {
			for (const el of node.exportClause.elements) {
				if (!el.isTypeOnly) {
					exportedNames.push({
						name: el.name.text,
						pos: el.name.getStart(ast),
					});
				}
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(ast);

	if (forbidDefaultExport && defaultExportPos !== null) {
		errors.push(
			`${normalized}:${lineNumber(source, defaultExportPos)} Hook（use-*）及 ${[...NAMED_EXPORT_ONLY_LAYERS].join("/")} 层必须统一使用具名导出（Named Export），禁止 export default。`,
		);
	}

	const isProviderFile =
		base.endsWith("-provider.tsx") ||
		base.endsWith("-provider.ts") ||
		exportedNames.some((item) => /^[A-Z][\w]*Provider$/.test(item.name));
	const isStoreFile = fromInfo.layer === "stores" && base.endsWith("-store.ts");

	const hookExports = exportedNames.filter((item) =>
		/^use[A-Z]/.test(item.name),
	);

	if (isUseFile && hookExports.length === 0) {
		errors.push(
			`${normalized}:1 以 "use-" 命名的文件必须至少导出一个 use* Hook。`,
		);
	}
	if (!isUseFile && !isProviderFile && !isStoreFile && hookExports.length > 0) {
		const first = hookExports[0];
		if (first) {
			errors.push(
				`${normalized}:${lineNumber(source, first.pos)} 导出了 Hook "${first.name}"，文件名必须以 "use-" 开头（Context Provider 或 stores/*-store.ts 除外）。`,
			);
		}
	}

	return errors;
}

/**
 * 检查 apps/web/src/lib 中的模块是否具备跨层/跨视图共享职责或宿主通信边界，阻止单一视图私有模型堆入 lib。
 * @param webSources 仓库相对路径 -> 文件源码映射。
 */
export function checkLibSharingConventions(
	webSources: ReadonlyMap<string, string>,
): string[] {
	const errors: string[] = [];
	const importersByLib = new Map<string, Set<string>>();
	const libCallsApi = new Set<string>();

	for (const filepath of webSources.keys()) {
		if (filepath.startsWith("apps/web/src/lib/") && filepath.endsWith(".ts")) {
			importersByLib.set(filepath, new Set());
		}
	}

	const normalizeToTs = (resolved: string) =>
		resolved.endsWith(".ts") || resolved.endsWith(".tsx")
			? resolved
			: `${resolved}.ts`;

	for (const [filepath, source] of webSources) {
		if (!filepath.startsWith("apps/web/src/") || filepath.endsWith(".css"))
			continue;
		if (filepath.endsWith("/routeTree.gen.ts")) continue;

		const ast = ts.createSourceFile(
			filepath,
			source,
			ts.ScriptTarget.Latest,
			true,
			filepath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);

		const recordSpec = (specifier: string) => {
			const resolved = resolveWebSpecifier(filepath, specifier);
			if (!resolved) return;
			const targetTs = normalizeToTs(resolved);
			if (
				filepath.startsWith("apps/web/src/lib/") &&
				targetTs === "apps/web/src/lib/api.ts"
			) {
				libCallsApi.add(filepath);
			}
			const bucket = importersByLib.get(targetTs);
			if (bucket && targetTs !== filepath) {
				bucket.add(filepath);
			}
		};

		const walk = (node: ts.Node) => {
			if (
				ts.isImportDeclaration(node) &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				recordSpec(node.moduleSpecifier.text);
			} else if (
				ts.isExportDeclaration(node) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				recordSpec(node.moduleSpecifier.text);
			} else if (
				ts.isCallExpression(node) &&
				node.expression.kind === ts.SyntaxKind.ImportKeyword &&
				node.arguments[0] &&
				ts.isStringLiteralLike(node.arguments[0])
			) {
				recordSpec(node.arguments[0].text);
			}
			ts.forEachChild(node, walk);
		};
		walk(ast);
	}

	for (const [libFile, importers] of importersByLib) {
		if (LIB_HOST_BRIDGES.has(libFile) || libCallsApi.has(libFile)) continue;
		if (importers.size === 0) {
			errors.push(
				`${libFile}:1 未被应用源码引用的孤立 lib 模块，请移除或接入实际调用方。`,
			);
			continue;
		}
		const viewSegments = new Set<string>();
		let hasNonViewImporter = false;
		for (const importer of importers) {
			const info = webLayerInfo(importer);
			if (!info) continue;
			if (info.layer === "views" && info.segment) {
				viewSegments.add(info.segment);
			} else {
				hasNonViewImporter = true;
			}
		}
		if (!hasNonViewImporter && viewSegments.size === 1) {
			const [onlyFeature] = viewSegments;
			errors.push(
				`${libFile}:1 仅被单一业务视图 views/${onlyFeature} 引用的纯逻辑模块禁止堆入共享 lib/，请就近移至 apps/web/src/views/${onlyFeature}/。`,
			);
		}
	}

	return errors;
}

function findEmptyDirectories(dir: string, root: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true }).filter(
		(entry) => entry.name !== ".DS_Store",
	);
	if (entries.length === 0) {
		return [
			`${toPosix(relative(root, dir))}:1 禁止保留空目录，请及时清理无文件目录。`,
		];
	}
	const empty: string[] = [];
	for (const entry of entries) {
		if (entry.isDirectory()) {
			empty.push(...findEmptyDirectories(resolve(dir, entry.name), root));
		}
	}
	return empty;
}

/**
 * 检查工作区顶层目录与顶层文件白名单、utils 分组结构、lib 共享边界及空目录残留。
 * @param root 仓库根目录绝对路径。
 */
export function checkWorkspaceStructure(root: string): string[] {
	const errors: string[] = [];

	const webSrc = resolve(root, "apps/web/src");
	for (const entry of readdirSync(webSrc, { withFileTypes: true })) {
		if (entry.name === ".DS_Store") continue;
		if (entry.isDirectory()) {
			if (!WEB_TOP_DIRS.has(entry.name)) {
				errors.push(
					`apps/web/src/${entry.name}:1 未登记的顶层目录 "${entry.name}"，允许目录：${[...WEB_TOP_DIRS].join(", ")}。`,
				);
			}
		} else if (!WEB_TOP_FILES.has(entry.name)) {
			errors.push(
				`apps/web/src/${entry.name}:1 禁止在 apps/web/src 根目录随意放置文件 "${entry.name}"，请归入对应职责目录。`,
			);
		}
	}

	const webUtils = resolve(root, "apps/web/src/utils");
	for (const entry of readdirSync(webUtils, { withFileTypes: true })) {
		if (entry.name === ".DS_Store") continue;
		if (!entry.isDirectory()) {
			errors.push(
				`apps/web/src/utils/${entry.name}:1 utils 根目录禁止平铺散落文件 "${entry.name}"，纯算法按子领域归入 utils/<domain>/，DOM/存储适配请放入 lib/。`,
			);
		}
	}

	const serverSrc = resolve(root, "apps/server/src");
	for (const entry of readdirSync(serverSrc, { withFileTypes: true })) {
		if (entry.name === ".DS_Store") continue;
		if (entry.isDirectory()) {
			if (!SERVER_TOP_DIRS.has(entry.name)) {
				errors.push(
					`apps/server/src/${entry.name}:1 未登记的服务端顶层目录 "${entry.name}"，允许目录：${[...SERVER_TOP_DIRS].join(", ")}。`,
				);
			}
		} else if (!SERVER_TOP_FILES.has(entry.name)) {
			errors.push(
				`apps/server/src/${entry.name}:1 禁止在 apps/server/src 根目录散落文件 "${entry.name}"，业务模块放入 modules/<feature>，离线脚本放入 scripts/。`,
			);
		}
	}

	for (const srcDir of [
		"apps/web/src",
		"apps/server/src",
		"apps/desktop/src",
		"packages/access/src",
		"packages/auth/src",
		"packages/calculators/src",
		"packages/db/src",
		"packages/desktop-bridge/src",
		"packages/lattice-grid/src",
		"packages/ui/src",
	]) {
		errors.push(...findEmptyDirectories(resolve(root, srcDir), root));
	}

	const webSources = new Map<string, string>();
	for (const filepath of new Bun.Glob("**/*.{ts,tsx}").scanSync({
		cwd: webSrc,
		absolute: true,
		onlyFiles: true,
	})) {
		const rel = toPosix(relative(root, filepath));
		webSources.set(rel, readFileSync(filepath, "utf8"));
	}
	errors.push(...checkLibSharingConventions(webSources));

	return errors;
}

if (import.meta.main) {
	const root = resolve(import.meta.dir, "..");
	const errors = checkWorkspaceStructure(root);

	for (const directory of [
		"apps/web/src",
		"apps/server/src",
		"apps/desktop/src",
		"packages/access/src",
		"packages/auth/src",
		"packages/calculators/src",
		"packages/db/src",
		"packages/desktop-bridge/src",
		"packages/lattice-grid/src",
		"packages/ui/src",
	]) {
		for (const filepath of new Bun.Glob("**/*").scanSync({
			cwd: resolve(root, directory),
			absolute: true,
			onlyFiles: true,
		})) {
			if (basename(filepath) === ".DS_Store") continue;
			const rel = toPosix(relative(root, filepath));
			if (/\.(?:ts|tsx|css)$/.test(filepath)) {
				errors.push(
					...checkSourceConventions(await Bun.file(filepath).text(), rel),
				);
			} else {
				errors.push(...checkFilenameConvention(rel));
			}
		}
	}

	if (errors.length > 0) {
		console.error(errors.join("\n"));
		process.exitCode = 1;
	} else {
		console.info(
			"架构约定检查通过：目录白名单、kebab-case 命名、单向依赖、lib/utils 边界、具名导出、Hook 规范、API 边界与样式隔离均合规。",
		);
	}
}
