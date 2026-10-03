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
