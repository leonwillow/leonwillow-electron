/**
 * @file 演示页的字体、共享字号阶梯、字重与等宽数字展示分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：直观展示全局排版令牌、语义文字颜色与内置字体，支持一键切换当前字体。
 * 被调用：views/admin/showcase/index.tsx。
 * 调用：共享 Button/Badge/Card、configs/fonts、主题 Store。
 * 功能：呈现共享字号与字重样本、等宽数字对齐、以及精选/全部内置字体的实时切换预览。
 * 预期结果：默认只展示精选 6 款字体避免并发加载开销，点击字体卡即可实时生效并标记当前字体。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import {
	CURATED_FONTS,
	FONT_CONFIG,
	FONT_GROUPS,
	type FontKey,
} from "@/configs/fonts";
import { useThemeStore } from "@/stores/theme-store";

const TYPE_SCALE = [
	{
		token: "text-2xl",
		role: "大标题 / 概览数字",
		sizeClass: "text-2xl font-semibold tracking-tight",
		sample: "工作台组件与视觉系统 128,450.00",
	},
	{
		token: "text-xl",
		role: "主页面标题",
		sizeClass: "text-xl font-semibold",
		sample: "资金追踪与核查分析视图 ABCxyz",
	},
	{
		token: "text-lg",
		role: "分区标题",
		sizeClass: "text-lg font-semibold",
		sample: "主题配色令牌与控件层次规范",
	},
	{
		token: "text-base",
		role: "二级菜单 / 弹窗标题",
		sizeClass: "text-base font-medium",
		sample: "人员与权限、文书取号与笔录归档",
	},
	{
		token: "text-sm",
		role: "卡片标题 / 标准正文",
		sizeClass: "text-sm",
		sample: "正文信息清晰易读，中英数字混排 2026-11-21 14:30:00",
	},
	{
		token: "text-control",
		role: "共享单行控件字号（0.8125rem）",
		sizeClass: "text-control",
		sample: "按钮、输入框、下拉选择器与分段单选共用此字号",
	},
	{
		token: "text-xs",
		role: "表格单元格 / 说明文字",
		sizeClass: "text-xs",
		sample: "用于卡片说明、表格列表、菜单项及表单帮助文案",
	},
	{
		token: "text-caption",
		role: "辅助标签 / 徽标角标（0.6875rem）",
		sizeClass: "text-caption",
		sample: "分组眉标、快捷键提示、色值元信息 · 随 rem 整体缩放",
	},
] as const;

const WEIGHT_SAMPLES = [
	{ label: "常规 400", weightClass: "font-normal" },
	{ label: "中等 500", weightClass: "font-medium" },
	{ label: "半粗 600", weightClass: "font-semibold" },
	{ label: "加粗 700", weightClass: "font-bold" },
] as const;

const ALL_FONT_KEYS = Object.keys(FONT_CONFIG) as FontKey[];

export default function TypographySection() {
	const currentFont = useThemeStore((state) => state.preferences.settings.font);
	const currentScale = useThemeStore(
		(state) => state.preferences.settings.scale,
	);
	const updateSettings = useThemeStore((state) => state.updateSettings);
	const [showAllFonts, setShowAllFonts] = useState(false);

	const visibleFontKeys: readonly FontKey[] = showAllFonts
		? ALL_FONT_KEYS
		: CURATED_FONTS.includes(currentFont)
			? CURATED_FONTS
			: [currentFont, ...CURATED_FONTS];

	const groupLabelMap = Object.fromEntries(
		FONT_GROUPS.map((group) => [group.key, group.label]),
	);

	return (
		<section
			aria-labelledby="showcase-typography-heading"
			className="space-y-4"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h2
						id="showcase-typography-heading"
						className="font-semibold text-foreground text-lg"
					>
						字体与排版
					</h2>
					<p className="text-muted-foreground text-xs">
						所有字号均来源于共享排版令牌并随全局 rem 缩放联动。
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline">
						当前字体：{FONT_CONFIG[currentFont]?.label ?? currentFont}
					</Badge>
					<Badge variant="secondary">缩放档位：{currentScale}</Badge>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>共享字号阶梯</CardTitle>
					<CardDescription>
						从页面大标题到辅助角标的完整字号层级，确保信息主次清晰。
					</CardDescription>
				</CardHeader>
				<CardContent className="divide-y">
					{TYPE_SCALE.map((row) => (
						<div
							key={row.token}
							className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4"
						>
							<div className="flex w-52 shrink-0 flex-col gap-0.5">
								<span className="font-medium font-mono text-foreground text-xs">
									{row.token}
								</span>
								<span className="text-caption text-muted-foreground">
									{row.role}
								</span>
							</div>
							<p
								className={cn("min-w-0 flex-1 text-foreground", row.sizeClass)}
							>
								{row.sample}
							</p>
						</div>
					))}
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>字重与语义文字色</CardTitle>
						<CardDescription>
							核对不同字重与正文、弱化及状态色文字的可读性。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-2.5">
							{WEIGHT_SAMPLES.map((item) => (
								<div key={item.label} className="rounded-md border p-2.5">
									<p className="text-caption text-muted-foreground">
										{item.label}
									</p>
									<p
										className={cn(
											"mt-1 text-foreground text-sm",
											item.weightClass,
										)}
									>
										中文排版与 UI 1234
									</p>
								</div>
							))}
						</div>
						<div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-xs">
							<span className="text-foreground">默认正文 foreground</span>
							<span className="text-muted-foreground">
								次要说明 muted-foreground
							</span>
							<span className="font-medium text-primary">主色强调 primary</span>
							<span className="font-medium text-info-foreground">
								信息 info-foreground
							</span>
							<span className="font-medium text-success-foreground">
								成功 success-foreground
							</span>
							<span className="font-medium text-warning-foreground">
								警告 warning-foreground
							</span>
							<span className="font-medium text-destructive-foreground">
								错误 destructive-foreground
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>正文字体与等宽数字对照</CardTitle>
						<CardDescription>
							金额、流水号与时间戳使用 font-mono 与 tabular-nums 保证列对齐。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="rounded-md border bg-card p-3">
							<p className="text-caption text-muted-foreground">
								无衬线正文（font-sans）
							</p>
							<p className="mt-1 text-foreground text-sm leading-relaxed">
								工作台在浅色与深色模式下统一采用 OKLCH
								语义色令牌，保障长表格阅读、表单录入与多窗体对比时的舒适度。
							</p>
						</div>
						<div className="rounded-md border bg-muted/40 p-3 font-mono tabular-nums">
							<p className="font-sans text-caption text-muted-foreground">
								等宽数字（font-mono tabular-nums）
							</p>
							<div className="mt-1.5 space-y-1 text-foreground text-xs">
								<div className="flex justify-between gap-2">
									<span>流水号 20261121-0001</span>
									<span>¥ 1,284,590.45</span>
								</div>
								<div className="flex justify-between gap-2">
									<span>流水号 20261121-0089</span>
									<span>¥ 88,012.00</span>
								</div>
								<div className="flex justify-between gap-2">
									<span>流水号 20261121-1042</span>
									<span>¥ 420.50</span>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<CardTitle>内置字体预览与一键试切</CardTitle>
							<CardDescription>
								点击任意字体卡片即可应用到整个工作台，便于直观对比不同字体观感。
							</CardDescription>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setShowAllFonts((prev) => !prev)}
						>
							{showAllFonts ? (
								<>
									<ChevronUpIcon aria-hidden="true" />
									收起为精选 {CURATED_FONTS.length} 款
								</>
							) : (
								<>
									<ChevronDownIcon aria-hidden="true" />
									展开全部 {ALL_FONT_KEYS.length} 款字体
								</>
							)}
						</Button>
					</div>
				</CardHeader>
				<CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{visibleFontKeys.map((key) => {
						const config = FONT_CONFIG[key];
						const active = currentFont === key;
						return (
							<button
								key={key}
								type="button"
								aria-pressed={active}
								onClick={() => updateSettings({ font: key })}
								className={cn(
									"flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
									active &&
										"border-primary bg-accent/50 ring-1 ring-primary/30",
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-1.5">
										<span className="font-medium text-foreground text-sm">
											{config.label}
										</span>
										<Badge variant="outline">
											{groupLabelMap[config.group] ?? config.group}
										</Badge>
									</div>
									{active ? (
										<Badge variant="default">
											<CheckIcon aria-hidden="true" />
											当前
										</Badge>
									) : null}
								</div>
								<p
									className="text-base text-foreground"
									style={{
										fontFamily: `var(${config.variable}), var(--font-sans)`,
									}}
								>
									Aa Bb Cc 0123456789 汉字预览
								</p>
								<p
									className="truncate text-muted-foreground text-xs"
									style={{
										fontFamily: `var(${config.variable}), var(--font-sans)`,
									}}
								>
									The quick brown fox jumps · 2026-11-21 ¥98,765.43
								</p>
								<span className="font-mono text-caption text-muted-foreground">
									{config.variable}
								</span>
							</button>
						);
					})}
				</CardContent>
			</Card>
		</section>
	);
}
