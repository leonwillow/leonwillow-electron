/**
 * @file 类 Nuxt 架构与命名门禁的行为测试。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：覆盖目录白名单、跨视图隔离、单向分层、Hook 命名、API 边界与样式防污染规则。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、node:path、./check-conventions。
 * 功能：验证合法源码通过检查，各类违规写法均被准确定位拒绝。
 * 预期结果：防止约定退化或误放行越界代码。
 */
import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	checkFilenameConvention,
	checkSourceConventions,
	checkWorkspaceStructure,
} from "./check-conventions";

test("当前真实工作区目录结构完全符合白名单且无空目录", () => {
	const root = resolve(import.meta.dir, "..");
	expect(checkWorkspaceStructure(root)).toEqual([]);
});

test("强制执行小写 kebab-case 文件名并放行路由约定与生成文件", () => {
	expect(
		checkFilenameConvention("apps/web/src/views/calculators/VatEditor.tsx")
			.length,
	).toBeGreaterThan(0);
	expect(
		checkFilenameConvention("apps/web/src/lib/vat_helper.ts").length,
	).toBeGreaterThan(0);
	expect(
		checkFilenameConvention("apps/web/src/views/calculators/vat-editor.tsx"),
	).toEqual([]);
	expect(
		checkFilenameConvention(
			"apps/web/src/routes/_workspace/calculators_.late-fees.tsx",
		),
	).toEqual([]);
	expect(checkFilenameConvention("apps/web/src/routeTree.gen.ts")).toEqual([]);
});

test("禁止跨业务视图私有引用及下层反向依赖上层", () => {
	expect(
		checkSourceConventions(
			'import { InquiryState } from "@/views/inquiries/controls"; export { InquiryState };',
			"apps/web/src/views/calculators/vat-editor.tsx",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			'import VatTable from "../calculators/vat-table"; export { VatTable };',
			"apps/web/src/views/funds/index.tsx",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			'import InquiryCaseDialog from "@/views/inquiries/case-dialog"; export { InquiryCaseDialog };',
			"apps/web/src/components/layout/use-inquiry-case-menu.tsx",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			'import WorkspaceMenu from "@/components/layout/workspace-menu"; export { WorkspaceMenu };',
			"apps/web/src/lib/calculators.ts",
		).length,
	).toBeGreaterThan(0);

	// 同一业务视图内部模块互引允许通过
	expect(
		checkSourceConventions(
			'import VatTable from "./vat-table"; export { VatTable };',
			"apps/web/src/views/calculators/vat-editor.tsx",
		),
	).toEqual([]);
});

test("强制 Hook 文件以 use- 命名，放行 Context Provider 与 Zustand Store", () => {
	expect(
		checkSourceConventions(
			"export function useCalculatorMenu() { return null; }",
			"apps/web/src/components/layout/calculator-sidebar.tsx",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			"export const helper = () => 1;",
			"apps/web/src/hooks/use-helper.ts",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			"export function useCalculatorMenu() { return null; }",
			"apps/web/src/components/layout/use-calculator-menu.tsx",
		),
	).toEqual([]);

	expect(
		checkSourceConventions(
			"export function DemoProvider() { return null; }\nexport function useDemo() { return null; }",
			"apps/web/src/components/layout/demo-actions.tsx",
		),
	).toEqual([]);

	expect(
		checkSourceConventions(
			"export const useThemeStore = () => null;",
			"apps/web/src/stores/theme-store.ts",
		),
	).toEqual([]);
});

test("限制底层 Eden api 实例只能在 lib 层封装调用，路由保持轻量纯净", () => {
	expect(
		checkSourceConventions(
			'import { api } from "@/lib/api"; export const load = () => api.api.funds.cases.get();',
			"apps/web/src/views/funds/index.tsx",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			'export const load = () => fetch("/api/health");',
			"apps/web/src/routes/login.tsx",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			'import { api } from "./api"; export const load = () => api.api.funds.cases.get();',
			"apps/web/src/lib/funds.ts",
		),
	).toEqual([]);

	expect(
		checkSourceConventions(
			'import { apiErrorMessage } from "@/lib/api"; export function useAsync() { return apiErrorMessage; }',
			"apps/web/src/hooks/use-async.ts",
		),
	).toEqual([]);
});

test("阻止业务选择器回流污染 globals.css", () => {
	expect(
		checkSourceConventions(
			".vat-table { width: 100%; }",
			"packages/ui/src/styles/globals.css",
		).length,
	).toBeGreaterThan(0);

	expect(
		checkSourceConventions(
			":root { --ui-scale: 0.95; }\n.scroll-area { overflow: hidden; }",
			"packages/ui/src/styles/globals.css",
		),
	).toEqual([]);
});
