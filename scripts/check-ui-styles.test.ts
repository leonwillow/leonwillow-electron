/**
 * @file UI 规范检查器的行为测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、./check-ui-styles。
 * 功能：给检查器提供允许与拒绝的源码样例。
 * 预期结果：规则能拒绝绕过令牌的写法，并允许基础组件定义尺寸。
 */
import { expect, test } from "bun:test";
import { checkUIStyleSource } from "./check-ui-styles";

test("拒绝不随全局规范管理的字号和页面高度覆盖", () => {
	for (const source of [
		'<p className="text-[12px]" />',
		'<p style={{ fontSize: "0.75rem" }} />',
		'<SelectTrigger className="h-8" />',
		'<Input className="text-sm" />',
	]) {
		expect(
			checkUIStyleSource(source, "apps/web/src/views/example.tsx").length,
		).toBeGreaterThan(0);
	}
});

test("允许语义字号、控件尺寸属性、响应式布局和语义色", () => {
	expect(
		checkUIStyleSource(
			'<SelectTrigger size="lg" className="w-full md:w-64 text-primary" />',
			"apps/web/src/views/example.tsx",
		),
	).toEqual([]);
	expect(
		checkUIStyleSource(
			'<span className="text-caption leading-normal" />',
			"apps/web/src/views/example.tsx",
		),
	).toEqual([]);
});

test("CSS 字号和缩放只能由共享样式维护", () => {
	const css =
		":root { --ui-scale: 0.95; font-size: calc(100% * var(--ui-scale)); }";
	expect(
		checkUIStyleSource(css, "apps/web/src/styles/example.css").length,
	).toBeGreaterThan(0);
	expect(checkUIStyleSource(css, "packages/ui/src/styles/globals.css")).toEqual(
		[],
	);
});
