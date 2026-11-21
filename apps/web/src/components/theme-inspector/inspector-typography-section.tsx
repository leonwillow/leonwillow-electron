/**
 * @file 主题分析面板的「排版语义」展示与编辑分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：精简信息密度，优先展示字号层级语义、字体族与字重语义及关键数值，支持切换语义档位与微调参数。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：ui Badge/Button/Select/Slider/TooltipText、configs/fonts、utils/theme/semantic-catalog。
 * 功能：切换元素字号语义层级、字体族语义（--font-sans/--font-mono）与全局字体、字重、对齐与字间距。
 * 预期结果：超长语义单行截断不挤压控件，修改即时同步到画布或主题草稿。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import { Slider } from "@leonwillow-electron/ui/components/slider";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";
import { CURATED_FONTS, FONT_CONFIG, type FontKey } from "@/configs/fonts";
import type { ThemeStyleProps } from "@/types/theme";
import {
	SEMANTIC_TYPOGRAPHY_TOKENS,
	SEMANTIC_WEIGHT_TOKENS,
} from "@/utils/theme/semantic-catalog";
import type { InspectedTypography } from "./theme-inspector-types";

type InspectorTypographySectionProps = {
	typography: InspectedTypography;
	activeFont: FontKey;
	globalLetterSpacing: string;
	onUpdateGlobalFont: (font: FontKey) => void;
	onUpdateGlobalToken: (key: keyof ThemeStyleProps, value: string) => void;
	onApplyElementOverride: (params: {
		cssProperty: string;
		propertyLabel: string;
		beforeSemantic: string;
		afterSemantic: string;
		value: string;
	}) => void;
};

export function InspectorTypographySection({
	typography,
	activeFont,
	globalLetterSpacing,
	onUpdateGlobalFont,
	onUpdateGlobalToken,
	onApplyElementOverride,
}: InspectorTypographySectionProps) {
	const currentSizeKey = typography.sizeToken?.token ?? "__custom__";
	const currentLetterSpacingEm =
		Number.parseFloat(globalLetterSpacing || "0") || 0;

	return (
		<div className="flex flex-col gap-2.5">
			{/* 字号层级语义 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<span className="shrink-0 text-caption text-muted-foreground">
							字号语义
						</span>
						<TooltipText content={typography.sizeSemanticLabel}>
							<span className="min-w-0 truncate font-semibold text-foreground text-xs">
								{typography.sizeSemanticLabel}
							</span>
						</TooltipText>
					</div>
					<Badge
						variant={typography.sizeToken ? "secondary" : "warning"}
						className="shrink-0 font-mono text-caption"
					>
						{typography.computedSizePx}px
					</Badge>
				</div>

				<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-muted/50 px-2 py-1 font-mono text-caption text-muted-foreground">
					<span>{typography.computedSizeRem}rem</span>
					<span>
						行高 {typography.computedLineHeightPx}px (
						{typography.lineHeightRatio})
					</span>
					{typography.tabularNums && <span>tabular-nums</span>}
				</div>

				<Select
					value={currentSizeKey}
					onValueChange={(nextToken) => {
						const found = SEMANTIC_TYPOGRAPHY_TOKENS.find(
							(item) => item.token === nextToken,
						);
						if (!found) return;
						onApplyElementOverride({
							cssProperty: "font-size",
							propertyLabel: "字号层级",
							beforeSemantic: typography.sizeSemanticLabel,
							afterSemantic: `${found.label} (${found.token})`,
							value: found.cssVar
								? `var(${found.cssVar}, ${found.rem}rem)`
								: `${found.rem}rem`,
						});
						onApplyElementOverride({
							cssProperty: "line-height",
							propertyLabel: "配套行高",
							beforeSemantic: `${typography.lineHeightRatio}`,
							afterSemantic: `${found.leading} (${found.token})`,
							value: String(found.leading),
						});
					}}
				>
					<SelectTrigger
						size="sm"
						className="w-full"
						aria-label="切换字号语义档位"
					>
						<span className="truncate">{typography.sizeSemanticLabel}</span>
					</SelectTrigger>
					<SelectContent data-theme-inspector="true" align="start">
						<SelectGroup>
							<SelectLabel>共享排版字号阶梯</SelectLabel>
							{SEMANTIC_TYPOGRAPHY_TOKENS.map((item) => (
								<SelectItem key={item.token} value={item.token}>
									<span className="flex w-full items-center justify-between gap-3">
										<span>{item.label}</span>
										<span className="font-mono text-caption text-muted-foreground">
											{item.token} · {item.rem}rem
										</span>
									</span>
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>

			{/* 字体族语义 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						字体族
					</span>
					<TooltipText content={typography.fontFamilySemantic}>
						<span className="min-w-0 truncate font-semibold text-foreground text-xs">
							{typography.fontFamilySemantic}
						</span>
					</TooltipText>
				</div>
				<div className="grid grid-cols-2 gap-1.5">
					<Button
						size="sm"
						variant={
							typography.fontFamilyToken === "--font-sans"
								? "secondary"
								: "outline"
						}
						onClick={() =>
							onApplyElementOverride({
								cssProperty: "font-family",
								propertyLabel: "字体族",
								beforeSemantic: typography.fontFamilySemantic,
								afterSemantic: "界面无衬线字体 (--font-sans)",
								value: "var(--font-sans)",
							})
						}
					>
						界面 Sans
					</Button>
					<Button
						size="sm"
						variant={
							typography.fontFamilyToken === "--font-mono"
								? "secondary"
								: "outline"
						}
						onClick={() =>
							onApplyElementOverride({
								cssProperty: "font-family",
								propertyLabel: "字体族",
								beforeSemantic: typography.fontFamilySemantic,
								afterSemantic: "等宽字体 (--font-mono)",
								value: "var(--font-mono)",
							})
						}
					>
						等宽 Mono
					</Button>
				</div>

				<div className="flex items-center justify-between gap-2 border-t pt-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						全局字体
					</span>
					<Select
						value={activeFont}
						onValueChange={(value) => {
							if (value && value in FONT_CONFIG) {
								onUpdateGlobalFont(value as FontKey);
							}
						}}
					>
						<SelectTrigger
							size="sm"
							className="w-40"
							aria-label="切换全局主题字体"
						>
							<span className="truncate">
								{FONT_CONFIG[activeFont]?.label ?? activeFont}
							</span>
						</SelectTrigger>
						<SelectContent data-theme-inspector="true" align="end">
							<SelectGroup>
								<SelectLabel>工作台精选字体</SelectLabel>
								{CURATED_FONTS.map((key) => (
									<SelectItem key={key} value={key}>
										{FONT_CONFIG[key].label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* 字重、对齐与字间距 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex items-center justify-between gap-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						字重语义
					</span>
					<span className="font-semibold text-foreground text-xs">
						{typography.weightToken.label} ({typography.computedWeight})
					</span>
				</div>
				<div className="grid grid-cols-4 gap-1">
					{SEMANTIC_WEIGHT_TOKENS.map((item) => (
						<Button
							key={item.token}
							size="xs"
							variant={
								typography.weightToken.weight === item.weight
									? "secondary"
									: "outline"
							}
							onClick={() =>
								onApplyElementOverride({
									cssProperty: "font-weight",
									propertyLabel: "字重语义",
									beforeSemantic: `${typography.weightToken.label} (${typography.computedWeight})`,
									afterSemantic: `${item.label} (${item.token})`,
									value: String(item.weight),
								})
							}
						>
							{item.label.slice(0, 2)}
						</Button>
					))}
				</div>

				<div className="flex items-center justify-between gap-2 border-t pt-2">
					<span className="text-caption text-muted-foreground">文本对齐</span>
					<div className="flex items-center gap-1">
						{(
							[
								{ value: "left", label: "左对齐", icon: AlignLeftIcon },
								{ value: "center", label: "居中对齐", icon: AlignCenterIcon },
								{ value: "right", label: "右对齐", icon: AlignRightIcon },
							] as const
						).map(({ value, label, icon: Icon }) => (
							<Button
								key={value}
								size="icon-xs"
								variant={
									typography.textAlign === value ||
									(value === "left" && typography.textAlign === "start")
										? "secondary"
										: "outline"
								}
								aria-label={label}
								onClick={() =>
									onApplyElementOverride({
										cssProperty: "text-align",
										propertyLabel: "文本对齐",
										beforeSemantic: typography.textAlign,
										afterSemantic: label,
										value,
									})
								}
							>
								<Icon aria-hidden="true" />
							</Button>
						))}
					</div>
				</div>

				<div className="flex flex-col gap-1.5 border-t pt-2">
					<div className="flex items-center justify-between text-caption">
						<span className="text-muted-foreground">全局字间距</span>
						<span className="font-mono text-foreground">
							{currentLetterSpacingEm.toFixed(2)}em
						</span>
					</div>
					<Slider
						aria-label="全局字间距"
						min={-0.05}
						max={0.12}
						step={0.01}
						value={[currentLetterSpacingEm]}
						onValueChange={(vals) => {
							const next = Array.isArray(vals) ? (vals[0] ?? 0) : vals;
							onUpdateGlobalToken(
								"letter-spacing",
								`${Number(next).toFixed(2)}em`,
							);
						}}
					/>
				</div>
			</div>
		</div>
	);
}
