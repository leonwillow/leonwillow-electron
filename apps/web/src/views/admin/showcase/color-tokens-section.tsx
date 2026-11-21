/**
 * @file 演示页的颜色令牌、语义状态色、图表色、圆角与阴影展示分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：实时采样文档根元素 CSS 变量，随主题预设、明暗模式与编辑器草稿即时同步。
 * 被调用：views/admin/showcase/index.tsx。
 * 调用：共享 Card/Badge/CopyText、utils/theme/color-converter。
 * 功能：分组呈现品牌主色、表面分层与悬停/选中对比、四种语义状态色、图表 5 色、圆角与阴影阶梯。
 * 预期结果：管理员切换主题或调整颜色时无需刷新即可直观核对色板层次与对比度。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { useEffect, useState } from "react";
import { colorFormatter } from "@/utils/theme/color-converter";

type TokenSwatch = {
	label: string;
	token: string;
	foregroundToken?: string;
	swatchClass: string;
	textClass: string;
	fallbackNote?: string;
};

type SemanticGroup = {
	name: string;
	token: string;
	foregroundToken: string;
	solidForegroundToken?: string;
	solidClass: string;
	tintClass: string;
	strongTintClass: string;
	summary: string;
};

const BRAND_TOKENS: readonly TokenSwatch[] = [
	{
		label: "品牌主色",
		token: "--primary",
		foregroundToken: "--primary-foreground",
		swatchClass: "bg-primary",
		textClass: "text-primary-foreground",
	},
	{
		label: "主色悬停",
		token: "--primary-hover",
		foregroundToken: "--primary-foreground",
		swatchClass: "bg-primary-hover",
		textClass: "text-primary-foreground",
		fallbackNote: "未显式声明时回退 primary 88%",
	},
	{
		label: "次要按钮底色",
		token: "--secondary",
		foregroundToken: "--secondary-foreground",
		swatchClass: "bg-secondary border",
		textClass: "text-secondary-foreground",
	},
	{
		label: "焦点环",
		token: "--ring",
		foregroundToken: "--primary-foreground",
		swatchClass: "bg-ring",
		textClass: "text-primary-foreground",
	},
];

const SURFACE_TOKENS: readonly TokenSwatch[] = [
	{
		label: "页面底色",
		token: "--background",
		foregroundToken: "--foreground",
		swatchClass: "bg-background border",
		textClass: "text-foreground",
	},
	{
		label: "卡片底色",
		token: "--card",
		foregroundToken: "--card-foreground",
		swatchClass: "bg-card border",
		textClass: "text-card-foreground",
	},
	{
		label: "弹层底色",
		token: "--popover",
		foregroundToken: "--popover-foreground",
		swatchClass: "bg-popover border",
		textClass: "text-popover-foreground",
	},
	{
		label: "侧栏底色",
		token: "--sidebar",
		foregroundToken: "--sidebar-foreground",
		swatchClass: "bg-sidebar border",
		textClass: "text-sidebar-foreground",
	},
	{
		label: "弱化 / 悬停底",
		token: "--muted",
		foregroundToken: "--muted-foreground",
		swatchClass: "bg-muted border",
		textClass: "text-muted-foreground",
	},
	{
		label: "菜单选中底",
		token: "--accent",
		foregroundToken: "--accent-foreground",
		swatchClass: "bg-accent border",
		textClass: "text-accent-foreground",
	},
	{
		label: "侧栏选中底",
		token: "--sidebar-accent",
		foregroundToken: "--sidebar-accent-foreground",
		swatchClass: "bg-sidebar-accent border",
		textClass: "text-sidebar-accent-foreground",
	},
	{
		label: "边框 / 输入线",
		token: "--border",
		foregroundToken: "--foreground",
		swatchClass: "bg-border",
		textClass: "text-foreground",
	},
	{
		label: "输入框描边",
		token: "--input",
		foregroundToken: "--foreground",
		swatchClass: "bg-input",
		textClass: "text-foreground",
	},
];

const SEMANTIC_GROUPS: readonly SemanticGroup[] = [
	{
		name: "信息 Info",
		token: "--info",
		foregroundToken: "--info-foreground",
		solidClass: "bg-info text-primary-foreground",
		tintClass: "bg-info/10 text-info-foreground",
		strongTintClass: "border border-info/30 bg-info/20 text-info-foreground",
		summary: "进行中、说明提示与同步状态",
	},
	{
		name: "成功 Success",
		token: "--success",
		foregroundToken: "--success-foreground",
		solidClass: "bg-success text-primary-foreground",
		tintClass: "bg-success/10 text-success-foreground",
		strongTintClass:
			"border border-success/30 bg-success/20 text-success-foreground",
		summary: "已完成、校验通过与正常启用",
	},
	{
		name: "警告 Warning",
		token: "--warning",
		foregroundToken: "--warning-foreground",
		solidForegroundToken: "--warning-solid-foreground",
		solidClass: "bg-warning text-warning-solid-foreground",
		tintClass: "bg-warning/10 text-warning-foreground",
		strongTintClass:
			"border border-warning/30 bg-warning/20 text-warning-foreground",
		summary: "待核对、归档视图与风险提示",
	},
	{
		name: "危险 Destructive",
		token: "--destructive",
		foregroundToken: "--destructive-foreground",
		solidForegroundToken: "--destructive-solid-foreground",
		solidClass: "bg-destructive text-destructive-solid-foreground",
		tintClass: "bg-destructive/10 text-destructive-foreground",
		strongTintClass:
			"border border-destructive/30 bg-destructive/20 text-destructive-foreground",
		summary: "删除确认、停用状态与表单报错",
	},
];

const CHART_TOKENS = [
	{ label: "图表 1", token: "--chart-1", swatchClass: "bg-chart-1" },
	{ label: "图表 2", token: "--chart-2", swatchClass: "bg-chart-2" },
	{ label: "图表 3", token: "--chart-3", swatchClass: "bg-chart-3" },
	{ label: "图表 4", token: "--chart-4", swatchClass: "bg-chart-4" },
	{ label: "图表 5", token: "--chart-5", swatchClass: "bg-chart-5" },
] as const;

const RADIUS_STEPS = [
	{ label: "sm", token: "--radius-sm", radiusClass: "rounded-sm" },
	{ label: "md", token: "--radius-md", radiusClass: "rounded-md" },
	{ label: "lg", token: "--radius-lg", radiusClass: "rounded-lg" },
	{ label: "xl", token: "--radius-xl", radiusClass: "rounded-xl" },
	{ label: "2xl", token: "--radius-2xl", radiusClass: "rounded-2xl" },
	{ label: "full", token: "9999px", radiusClass: "rounded-full" },
] as const;

const SHADOW_STEPS = [
	{ label: "shadow-2xs", shadowClass: "shadow-2xs" },
	{ label: "shadow-xs", shadowClass: "shadow-xs" },
	{ label: "shadow-sm", shadowClass: "shadow-sm" },
	{ label: "shadow-md", shadowClass: "shadow-md" },
	{ label: "shadow-lg", shadowClass: "shadow-lg" },
	{ label: "shadow-xl", shadowClass: "shadow-xl" },
] as const;

const ALL_SAMPLED_TOKENS = Array.from(
	new Set([
		...BRAND_TOKENS.flatMap((item) =>
			item.foregroundToken ? [item.token, item.foregroundToken] : [item.token],
		),
		...SURFACE_TOKENS.flatMap((item) =>
			item.foregroundToken ? [item.token, item.foregroundToken] : [item.token],
		),
		...SEMANTIC_GROUPS.flatMap((group) => [
			group.token,
			group.foregroundToken,
			...(group.solidForegroundToken ? [group.solidForegroundToken] : []),
		]),
		...CHART_TOKENS.map((item) => item.token),
		"--radius",
	]),
);

type SampledValue = {
	raw: string;
	hex: string;
};

function readTokenValues(): Record<string, SampledValue> {
	const styles = getComputedStyle(document.documentElement);
	const result: Record<string, SampledValue> = {};
	for (const token of ALL_SAMPLED_TOKENS) {
		const raw = styles.getPropertyValue(token).trim();
		if (!raw) {
			result[token] = { raw: "", hex: "" };
			continue;
		}
		if (token === "--radius") {
			result[token] = { raw, hex: "" };
			continue;
		}
		const hex = colorFormatter(raw, "hex").toUpperCase();
		result[token] = { raw, hex: hex.startsWith("#") ? hex : "" };
	}
	return result;
}

function SwatchCard({
	item,
	values,
}: {
	item: TokenSwatch;
	values: Record<string, SampledValue>;
}) {
	const main = values[item.token];
	const fg = item.foregroundToken ? values[item.foregroundToken] : undefined;
	return (
		<div className="flex flex-col overflow-hidden rounded-lg border bg-card">
			<div
				className={cn(
					"flex h-16 items-end justify-between p-2.5",
					item.swatchClass,
				)}
			>
				<span className={cn("font-medium text-sm", item.textClass)}>
					Aa 示例
				</span>
				{main?.hex ? (
					<span
						className={cn(
							"rounded-sm px-1.5 py-0.5 font-mono text-caption opacity-90",
							item.textClass,
						)}
					>
						{main.hex}
					</span>
				) : null}
			</div>
			<div className="flex flex-col gap-1 p-2.5">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-foreground text-xs">
						{item.label}
					</span>
					{main?.hex ? (
						<CopyText
							value={main.hex}
							className="font-mono text-caption text-muted-foreground"
						/>
					) : (
						<span className="text-caption text-muted-foreground">动态派生</span>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
					<CopyText value={item.token} className="font-mono" />
					{fg?.hex && item.foregroundToken ? (
						<span className="font-mono">字 {fg.hex}</span>
					) : null}
				</div>
				<p className="truncate font-mono text-caption text-muted-foreground/80">
					{main?.raw || item.fallbackNote || "—"}
				</p>
			</div>
		</div>
	);
}

export default function ColorTokensSection() {
	const [values, setValues] = useState<Record<string, SampledValue>>(() =>
		readTokenValues(),
	);

	// 监听文档根元素 class、style 与圆角属性变化，实时同步主题预设、明暗模式和编辑器预览色值。
	useEffect(() => {
		const refresh = () => setValues(readTokenValues());
		const frame = requestAnimationFrame(refresh);
		const observer = new MutationObserver(refresh);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style", "data-theme-radius"],
		});
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	return (
		<section aria-labelledby="showcase-colors-heading" className="space-y-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h2
						id="showcase-colors-heading"
						className="font-semibold text-foreground text-lg"
					>
						颜色与设计令牌
					</h2>
					<p className="text-muted-foreground text-xs">
						实时读取当前生效主题的 CSS 变量，点击变量名或 HEX 值可直接复制。
					</p>
				</div>
				<Badge variant="outline" className="font-mono">
					--radius: {values["--radius"]?.raw || "默认"}
				</Badge>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>品牌主色与交互色</CardTitle>
					<CardDescription>
						展示主按钮常态与悬停色差、次要底色及焦点环色。
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{BRAND_TOKENS.map((item) => (
						<SwatchCard key={item.token} item={item} values={values} />
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>背景表面、层级与边线</CardTitle>
					<CardDescription>
						对比底色、卡片、侧栏，以及悬停（muted）、菜单选中（accent）和侧栏选中（sidebar-accent）的分层差异。
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{SURFACE_TOKENS.map((item) => (
							<SwatchCard key={item.token} item={item} values={values} />
						))}
					</div>
					<div className="rounded-lg border bg-background p-3">
						<p className="mb-2 font-medium text-muted-foreground text-xs">
							交互分层实时对照（同底色下观察悬停与选中区分度）
						</p>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
							<div className="rounded-md border bg-card px-3 py-2 text-card-foreground text-xs">
								常态容器 · bg-card
							</div>
							<div className="rounded-md border bg-muted px-3 py-2 text-foreground text-xs">
								悬停提示 · bg-muted
							</div>
							<div className="rounded-md border bg-accent px-3 py-2 font-medium text-accent-foreground text-xs">
								下拉选中 · bg-accent
							</div>
							<div className="rounded-md border bg-sidebar-accent px-3 py-2 font-medium text-sidebar-accent-foreground text-xs">
								侧栏选中 · bg-sidebar-accent
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>语义状态色</CardTitle>
					<CardDescription>
						四种业务状态色同时展示实心填充、10% 浅底文字和 20% 描边强调效果。
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{SEMANTIC_GROUPS.map((group) => {
						const base = values[group.token];
						const fg = values[group.foregroundToken];
						return (
							<div
								key={group.token}
								className="flex flex-col gap-2.5 rounded-lg border bg-card p-3"
							>
								<div className="flex items-center justify-between gap-2">
									<div>
										<p className="font-medium text-foreground text-sm">
											{group.name}
										</p>
										<p className="text-caption text-muted-foreground">
											{group.summary}
										</p>
									</div>
									<div className="flex flex-col items-end font-mono text-caption text-muted-foreground">
										{base?.hex ? <CopyText value={base.hex} /> : null}
										{fg?.hex ? <span>字 {fg.hex}</span> : null}
									</div>
								</div>
								<div className="grid grid-cols-3 gap-2 text-center text-xs">
									<div
										className={cn(
											"rounded-md px-2 py-2 font-medium",
											group.solidClass,
										)}
									>
										实心填充
									</div>
									<div
										className={cn(
											"rounded-md px-2 py-2 font-medium",
											group.tintClass,
										)}
									>
										10% 浅底
									</div>
									<div
										className={cn(
											"rounded-md px-2 py-2 font-medium",
											group.strongTintClass,
										)}
									>
										20% 强调
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-caption text-muted-foreground">
									<CopyText value={group.token} />
									<CopyText value={group.foregroundToken} />
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>图表色板（Chart 1–5）</CardTitle>
						<CardDescription>用于统计图表与分组系列区分。</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{CHART_TOKENS.map((item) => {
							const sample = values[item.token];
							return (
								<div
									key={item.token}
									className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5"
								>
									<div className="flex items-center gap-2.5">
										<span
											className={cn(
												"size-5 shrink-0 rounded-sm",
												item.swatchClass,
											)}
											aria-hidden="true"
										/>
										<span className="font-medium text-xs">{item.label}</span>
									</div>
									<div className="flex items-center gap-2 font-mono text-caption text-muted-foreground">
										<CopyText value={item.token} />
										{sample?.hex ? <CopyText value={sample.hex} /> : null}
									</div>
								</div>
							);
						})}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>圆角阶梯</CardTitle>
						<CardDescription>随当前主题圆角半径同步缩放。</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-3 gap-2.5">
						{RADIUS_STEPS.map((step) => (
							<div
								key={step.label}
								className="flex flex-col items-center gap-1.5"
							>
								<div
									className={cn(
										"flex h-12 w-full items-center justify-center border border-primary/40 bg-primary/10 font-mono text-primary text-xs",
										step.radiusClass,
									)}
								>
									{step.label}
								</div>
								<span className="font-mono text-caption text-muted-foreground">
									{step.token}
								</span>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>阴影阶梯</CardTitle>
						<CardDescription>用于卡片、浮层与弹窗层次感。</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-3">
						{SHADOW_STEPS.map((step) => (
							<div
								key={step.label}
								className={cn(
									"flex h-12 items-center justify-center rounded-lg border bg-card font-mono text-foreground text-xs",
									step.shadowClass,
								)}
							>
								{step.label}
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
