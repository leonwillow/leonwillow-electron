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
