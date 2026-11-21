/**
 * @file 主题分析工具纯语义目录、令牌解析、对比度计算与提示词导出测试。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：验证管理员主题分析工具的核心纯算法，确保颜色/排版/尺寸/间距/圆角/阴影语义准确识别。
 * 被调用：bun run test:ui。
 * 调用：bun:test、configs/theme-variables、utils/theme/semantic-catalog。
 * 功能：覆盖全量语义色目录完备性、Tailwind 状态类解析、CSS var/color-mix 溯源、排版/间距/圆角/阴影匹配与提示词格式化。
 * 预期结果：语义解析与主题令牌目录保持一致，不遗漏任意内置语义令牌。
 */
import { describe, expect, test } from "bun:test";
import {
	COLOR_KEYS,
	OPTIONAL_COLOR_KEYS,
	STATUS_COLOR_KEYS,
} from "@/configs/theme-variables";
import {
	computeContrastInfo,
	extractCssVarToken,
	formatInspectorPrompt,
	matchControlSizeSemantic,
	matchRadiusSemantic,
	matchShadowSemantic,
	matchSpacingSemantic,
	matchTypographySemantic,
	parseTailwindColorClasses,
	SEMANTIC_COLOR_MAP,
	SEMANTIC_SLOT_LABELS,
} from "@/utils/theme/semantic-catalog";

describe("theme inspector semantic catalog & resolvers", () => {
	test("语义色目录覆盖全部基础色、状态语义色与可选派生色", () => {
		const requiredKeys = [
			...COLOR_KEYS,
			...STATUS_COLOR_KEYS,
			...OPTIONAL_COLOR_KEYS,
		];
		for (const key of requiredKeys) {
			const meta = SEMANTIC_COLOR_MAP.get(key);
			expect(meta, `缺少语义色目录项: ${key}`).toBeDefined();
			expect(meta?.label.length).toBeGreaterThan(0);
			expect(meta?.varName).toBe(`--${key}`);
			expect(meta?.editable).toBe(true);
		}
	});

	test("准确解析 Tailwind 语义色类、透明度修饰及交互态变体", () => {
		const parsedLight = parseTailwindColorClasses(
			[
				"bg-primary",
				"text-primary-foreground",
				"border",
				"hover:not-disabled:not-aria-disabled:bg-primary-hover",
				"focus-visible:ring-ring/50",
				"dark:bg-input/30",
				"data-[selected]:bg-accent",
			],
			false,
		);
		expect(parsedLight.base.background?.tokenKey).toBe("primary");
		expect(parsedLight.base.background?.opacityPercent).toBe(100);
		expect(parsedLight.base.color?.tokenKey).toBe("primary-foreground");
		expect(parsedLight.base.border?.tokenKey).toBe("border");
		// 浅色模式不应用 dark:bg-input/30；not-disabled 保护前缀不得误判为禁用态
		expect(parsedLight.states.some((s) => s.tokenKey === "input")).toBe(false);
		expect(parsedLight.states.some((s) => s.state === "disabled")).toBe(false);
		expect(
			parsedLight.states.find(
				(s) => s.state === "hover" && s.tokenKey === "primary-hover",
			),
		).toBeDefined();
		expect(
			parsedLight.states.find(
				(s) =>
					s.state === "focus" &&
					s.tokenKey === "ring" &&
					s.opacityPercent === 50,
			),
		).toBeDefined();
		expect(
			parsedLight.states.find(
				(s) => s.state === "selected" && s.tokenKey === "accent",
			),
		).toBeDefined();

		// 深色模式命中 dark:bg-input/30
		const parsedDark = parseTailwindColorClasses(
			["bg-card", "dark:bg-input/30"],
			true,
		);
		expect(parsedDark.base.background?.tokenKey).toBe("input");
		expect(parsedDark.base.background?.opacityPercent).toBe(30);
	});

	test("准确区分聚焦/校验异常/展开状态与部位，且深色覆盖自动去重", () => {
		const infoButtonClasses = [
			"border",
			"border-transparent",
			"bg-transparent",
			"text-info-foreground",
			"hover:not-disabled:not-aria-disabled:bg-info/10",
			"focus-visible:border-info/40",
			"focus-visible:ring-info/20",
			"aria-invalid:border-destructive",
			"aria-invalid:ring-destructive/20",
			"dark:aria-invalid:border-destructive/50",
			"dark:aria-invalid:ring-destructive/40",
		];

		// 浅色模式：border-transparent 覆盖 border，aria-invalid 归入 invalid 而非 focus
		const light = parseTailwindColorClasses(infoButtonClasses, false);
		expect(light.base.background?.tokenKey).toBe("transparent");
		expect(light.base.border?.tokenKey).toBe("transparent");
		expect(light.base.color?.tokenKey).toBe("info-foreground");
		expect(
			light.states
				.filter((s) => s.state === "focus")
				.map((s) => ({
					part: s.part,
					partLabel: s.partLabel,
					tokenKey: s.tokenKey,
					opacity: s.opacityPercent,
				})),
		).toEqual([
			{ part: "border", partLabel: "边框", tokenKey: "info", opacity: 40 },
			{ part: "ring", partLabel: "光环", tokenKey: "info", opacity: 20 },
		]);
		expect(
			light.states
				.filter((s) => s.state === "invalid")
				.map((s) => ({
					part: s.part,
					tokenKey: s.tokenKey,
					opacity: s.opacityPercent,
				})),
		).toEqual([
			{ part: "border", tokenKey: "destructive", opacity: 100 },
			{ part: "ring", tokenKey: "destructive", opacity: 20 },
		]);

		// 深色模式：dark:aria-invalid:* 覆盖浅色默认值，绝不重复展示两条
		const dark = parseTailwindColorClasses(infoButtonClasses, true);
		expect(
			dark.states
				.filter((s) => s.state === "invalid")
				.map((s) => ({
					part: s.part,
					tokenKey: s.tokenKey,
					opacity: s.opacityPercent,
				})),
		).toEqual([
			{ part: "border", tokenKey: "destructive", opacity: 50 },
			{ part: "ring", tokenKey: "destructive", opacity: 40 },
		]);
	});

	test("border 简写不覆盖显式边色、激活 DOM 态提升为常态且支持复合态与 color-mix", () => {
		// 无论类名先后顺序，显式 border-input / border-transparent 均高于 border 简写
		const reversedBorder = parseTailwindColorClasses(
			["border-input", "border"],
			false,
		);
		expect(reversedBorder.base.border?.tokenKey).toBe("input");

		const reversedTransparent = parseTailwindColorClasses(
			["border-transparent", "border"],
			false,
		);
		expect(reversedTransparent.base.border?.tokenKey).toBe("transparent");

		// TabsTrigger 激活态提升：浅色 data-active:bg-background，深色 dark:data-active:bg-input/30
		const tabClasses = [
			"border",
			"border-transparent",
			"text-foreground/60",
			"data-active:bg-background",
			"data-active:text-foreground",
			"dark:data-active:border-input",
			"dark:data-active:bg-input/30",
			"dark:data-active:text-foreground",
		];
		const activeLightTab = parseTailwindColorClasses(tabClasses, false, {
			selected: true,
		});
		expect(activeLightTab.base.background?.tokenKey).toBe("background");
		expect(activeLightTab.base.color?.tokenKey).toBe("foreground");

		const activeDarkTab = parseTailwindColorClasses(tabClasses, true, {
			selected: true,
		});
		expect(activeDarkTab.base.background?.tokenKey).toBe("input");
		expect(activeDarkTab.base.background?.opacityPercent).toBe(30);
		expect(activeDarkTab.base.border?.tokenKey).toBe("input");

		// SelectItem 复合态：未选中时 focus 保持 muted，选中时 focus 切换为 accent
		const selectItemClasses = [
			"focus:bg-muted",
			"data-[selected]:bg-accent",
			"data-[selected]:focus:bg-accent",
		];
		const unselectedItem = parseTailwindColorClasses(selectItemClasses, false, {
			selected: false,
		});
		expect(
			unselectedItem.states.find((s) => s.state === "focus" && s.part === "bg")
				?.tokenKey,
		).toBe("muted");

		const selectedItem = parseTailwindColorClasses(selectItemClasses, false, {
			selected: true,
		});
		expect(selectedItem.base.background?.tokenKey).toBe("accent");
		expect(
			selectedItem.states.find((s) => s.state === "focus" && s.part === "bg")
				?.tokenKey,
		).toBe("accent");

		// 次要按钮 color-mix 悬停色准确提取 --secondary 且不误将前景 5% 混合比例当成透明度
		const secondaryHover = parseTailwindColorClasses(
			[
				"bg-secondary",
				"hover:not-disabled:not-aria-disabled:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
				"aria-expanded:bg-secondary",
			],
			false,
		);
		expect(
			secondaryHover.states.find((s) => s.state === "hover" && s.part === "bg"),
		).toMatchObject({
			tokenKey: "secondary",
			opacityPercent: 100,
			partLabel: "背景",
		});
		expect(
			secondaryHover.states.find(
				(s) => s.state === "expanded" && s.part === "bg",
			),
		).toMatchObject({
			stateLabel: "展开",
			tokenKey: "secondary",
		});

		// 全量关键 data-slot 均已收录中文语义
		for (const slot of [
			"tooltip-trigger",
			"popover-trigger",
			"select-trigger",
			"tabs-trigger",
			"accordion-trigger",
			"time-picker-input",
		]) {
			expect(SEMANTIC_SLOT_LABELS[slot]?.label.length).toBeGreaterThan(0);
		}
	});

	test("准确提取样式表规则中的 CSS 变量、全局线条色回退与 oklab 混合透明度", () => {
		expect(
			extractCssVarToken("var(--ui-line-color, var(--sidebar-border))"),
		).toEqual({
			tokenKey: "sidebar-border",
			opacityPercent: 100,
			viaGlobalLineColor: true,
		});

		expect(
			extractCssVarToken(
				"color-mix(in oklab, var(--primary) 15%, transparent)",
			),
		).toEqual({
			tokenKey: "primary",
			opacityPercent: 15,
			viaGlobalLineColor: false,
		});
	});

	test("排版、控件尺寸、间距、圆角与阴影语义匹配准确", () => {
		// 95% 缩放根字号 15.2px 下，text-control 为 0.8125rem = 12.35px
		const typo = matchTypographySemantic([], 12.35, 15.2);
		expect(typo.matched?.token).toBe("text-control");

		const typoByClass = matchTypographySemantic(["text-caption"], 10.45, 15.2);
		expect(typoByClass.matched?.token).toBe("text-caption");
		expect(typoByClass.source).toBe("class");

		const control = matchControlSizeSemantic(26.6, 15.2, ["h-control-md"]);
		expect(control.matched?.token).toBe("control-md");

		const gutter = matchSpacingSemantic(11.4, 15.2);
		expect(gutter.matched?.token).toBe("workspace-gutter");

		const radius = matchRadiusSemantic(10, 16, 0.625, []);
		expect(radius?.token).toBe("rounded-lg");

		const shadow = matchShadowSemantic(
			"0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
			[],
		);
		expect(shadow.token).toBe("shadow-sm");
		const computedShadow = matchShadowSemantic(
			"rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px",
			[],
		);
		expect(computedShadow.token).toBe("shadow-lg");
	});

	test("WCAG 对比度计算与 AI 提示词导出格式化", () => {
		const high = computeContrastInfo("#141414", "#ffffff");
		expect(high?.level).toBe("aaa");
		expect(high?.ratio).toBeGreaterThan(15);

		const low = computeContrastInfo("#cccccc", "#ffffff");
		expect(low?.level).toBe("fail");

		const prompt = formatInspectorPrompt({
			presetLabel: "Vuexy",
			mode: "light",
			pathname: "/calculators",
			tokenChanges: [
				{
					tokenKey: "primary",
					semanticLabel: "品牌主色",
					mode: "light",
					before: "#7367F0",
					after: "#5E50EE",
				},
			],
			elementChanges: [
				{
					elementLabel: "卡片容器",
					selector: 'div[data-slot="card"]',
					propertyLabel: "背景表面色",
					cssProperty: "background-color",
					beforeSemantic: "卡片纸面背景",
					afterSemantic: "弱化 / 悬停底色 (--muted)",
					afterValue: "var(--muted)",
				},
			],
		});
		expect(prompt).toContain("全局主题语义令牌修改");
		expect(prompt).toContain("品牌主色");
		expect(prompt).toContain("组件元素语义与参数修改");
		expect(prompt).toContain("卡片容器");
	});
});
