/**
 * @file 共享类名合并规则的回归测试。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：当前行为的回归约束，不进入产品构建。
 * 被调用：Bun 测试命令。
 * 调用：bun:test、../src/components/button、../src/lib/utils。
 * 功能：检查控件尺寸、排版令牌与颜色类的冲突消解。
 * 预期结果：语义字号与颜色独立，后指定尺寸正确覆盖前值。
 */
import { describe, expect, test } from "bun:test";
import { buttonVariants } from "../src/components/button";
import { cn } from "../src/lib/utils";

describe("shared UI token class merging", () => {
	test("font tokens preserve semantic colors and font-size precedence", () => {
		expect(cn("text-control/relaxed", "text-muted-foreground")).toBe(
			"text-control/relaxed text-muted-foreground",
		);
		expect(cn("text-caption", "text-muted-foreground")).toBe(
			"text-caption text-muted-foreground",
		);
		expect(cn("text-xs", "text-control/relaxed")).toBe("text-control/relaxed");
		expect(cn("text-control/relaxed", "text-caption")).toBe("text-caption");
	});

	test("button variants retain foreground colors with shared font tokens", () => {
		for (const [variant, color] of [
			["default", "text-primary-foreground"],
			["destructive", "text-destructive"],
			["link", "text-primary"],
		] as const) {
			const classes = cn(buttonVariants({ variant, size: "default" })).split(
				" ",
			);
			expect(classes).toContain(color);
			expect(classes).toContain("text-control/relaxed");
		}
	});

	test("control size overrides leave one effective dimension", () => {
		expect(cn("h-control-md", "h-control-lg")).toBe("h-control-lg");
		expect(cn("h-7", "h-control-lg")).toBe("h-control-lg");
		expect(cn("size-control-md", "size-control-lg")).toBe("size-control-lg");
		expect(cn("size-control-md", "h-control-lg")).toBe(
			"size-control-md h-control-lg",
		);
	});
});
