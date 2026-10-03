import { relative, resolve } from "node:path";
import ts from "typescript";

// 限制新增代码绕过全局排版和控件尺寸。基础组件的尺寸定义仍由 packages/ui 管理。
export function checkUIStyleSource(source: string, filename: string): string[] {
	const errors: string[] = [];
	const report = (position: number, message: string) => {
		const line = source.slice(0, position).split("\n").length;
		errors.push(`${filename}:${line} ${message}`);
	};
	if (filename.endsWith(".css")) {
		if (filename !== "packages/ui/src/styles/globals.css") {
			for (const match of source.matchAll(
				/(?:font-size|line-height|--ui-scale|--text-[\w-]+|--spacing(?:-[\w-]+)?)\s*:/g,
			)) {
				report(match.index, "排版和缩放令牌必须定义在共享 globals.css。");
			}
		}
		return errors;
	}
	const file = ts.createSourceFile(
		filename,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const visit = (node: ts.Node) => {
		if (
			ts.isStringLiteralLike(node) &&
			/(?:text|leading)-\[(?:length:)?(?:[\d.]|calc\(|clamp\(|min\(|max\(|var\(--text-)/.test(
				node.text,
			)
		) {
			report(
				node.getStart(file),
				"使用 text-control、text-caption 或标准字号/行高令牌，禁止临时字号。",
			);
		}
		if (
			ts.isPropertyAssignment(node) &&
			/^(?:fontSize|lineHeight|font-size|line-height|--ui-scale|--text-[\w-]+|--spacing(?:-[\w-]+)?)$/.test(
				node.name.getText(file).replace(/["']/g, ""),
			)
		) {
			report(node.getStart(file), "禁止内联字号/行高，使用共享排版令牌。");
		}
		if (
			filename.startsWith("apps/web/") &&
			ts.isJsxAttribute(node) &&
			node.name.getText(file) === "className"
		) {
			const parent = node.parent.parent;
			if (
				(ts.isJsxOpeningElement(parent) ||
					ts.isJsxSelfClosingElement(parent)) &&
				/^(?:Button|Input|SelectTrigger|RadioGroup)$/.test(
					parent.tagName.getText(file),
				) &&
				(/(?:^|[\s"':])(?:h|min-h|max-h|size)-(?:\d|\[|\(|control-|full\b|auto\b|screen\b|dvh\b)/.test(
					node.getText(file),
				) ||
					/(?:^|[\s"':])text-(?:xs|sm|base|lg|\d*xl|control|caption)(?![\w-])/.test(
						node.getText(file),
					))
			) {
				report(
					node.getStart(file),
					"控件高度请使用 size 属性，控件字号由基础组件管理，禁止在页面覆盖。",
				);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return errors;
}

if (import.meta.main) {
	const root = resolve(import.meta.dir, "..");
	const errors: string[] = [];
	for (const directory of ["apps/web/src", "packages/ui/src"]) {
		for (const filename of new Bun.Glob("**/*.{ts,tsx,css}").scanSync({
			cwd: resolve(root, directory),
			absolute: true,
		})) {
			if (filename.endsWith("env.ts") || filename.endsWith("routeTree.gen.ts"))
				continue;
			errors.push(
				...checkUIStyleSource(
					await Bun.file(filename).text(),
					relative(root, filename),
				),
			);
		}
	}
	if (errors.length) {
		console.error(errors.join("\n"));
		process.exitCode = 1;
	} else {
		console.info("UI 规范检查通过：统一排版令牌和控件尺寸。");
	}
}
