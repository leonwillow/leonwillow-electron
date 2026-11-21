/**
 * @file 主题分析面板的「外观、圆角、线宽与阴影语义」展示与编辑分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：精简信息密度，优先呈现圆角阶梯、全局线宽与阴影层次语义，长语义单行截断并悬停显示全文。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：ui Badge/Button/Select/Slider/TooltipText、utils/theme/semantic-catalog、types/theme。
 * 功能：切换元素圆角/线宽/阴影语义与不透明度，支持联动调节全站基准圆角与线宽。
 * 预期结果：排版紧凑清晰，全局与局部修改实时生效。
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
import type { BorderWidth, Radius } from "@/types/theme";
import {
	SEMANTIC_RADIUS_TOKENS,
	SEMANTIC_SHADOW_TOKENS,
} from "@/utils/theme/semantic-catalog";
import type { InspectedAppearance } from "./theme-inspector-types";

const GLOBAL_RADIUS_OPTIONS: readonly { value: Radius; label: string }[] = [
	{ value: "none", label: "无" },
	{ value: "sm", label: "小" },
	{ value: "md", label: "中" },
	{ value: "lg", label: "大" },
];

const GLOBAL_BORDER_WIDTHS: readonly BorderWidth[] = [0.5, 1, 1.5, 2];

type InspectorAppearanceSectionProps = {
	appearance: InspectedAppearance;
	globalRadius: Radius;
	globalBorderWidth: BorderWidth;
	onUpdateGlobalRadius: (radius: Radius) => void;
	onUpdateGlobalBorderWidth: (width: BorderWidth) => void;
	onApplyElementOverride: (params: {
		cssProperty: string;
		propertyLabel: string;
		beforeSemantic: string;
		afterSemantic: string;
		value: string;
	}) => void;
};

export function InspectorAppearanceSection({
	appearance,
	globalRadius,
	globalBorderWidth,
	onUpdateGlobalRadius,
	onUpdateGlobalBorderWidth,
	onApplyElementOverride,
}: InspectorAppearanceSectionProps) {
	const currentRadiusKey = appearance.radiusToken?.token ?? "__custom__";

	return (
		<div className="flex flex-col gap-2.5">
			{/* 圆角语义 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<span className="shrink-0 text-caption text-muted-foreground">
							圆角语义
						</span>
						<TooltipText content={appearance.radiusSemanticLabel}>
							<span className="min-w-0 truncate font-semibold text-foreground text-xs">
								{appearance.radiusSemanticLabel}
							</span>
						</TooltipText>
					</div>
					<Badge variant="outline" className="shrink-0 font-mono text-caption">
						{appearance.radiusPx}px
					</Badge>
				</div>

				<Select
					value={currentRadiusKey}
					onValueChange={(nextToken) => {
						const found = SEMANTIC_RADIUS_TOKENS.find(
							(item) => item.token === nextToken,
						);
						if (!found) return;
						onApplyElementOverride({
							cssProperty: "border-radius",
							propertyLabel: "圆角语义",
							beforeSemantic: appearance.radiusSemanticLabel,
							afterSemantic: found.label,
							value: found.cssValue,
						});
					}}
				>
					<SelectTrigger size="sm" className="w-full" aria-label="切换圆角语义">
						<span className="truncate">{appearance.radiusSemanticLabel}</span>
					</SelectTrigger>
					<SelectContent data-theme-inspector="true" align="start">
						<SelectGroup>
							<SelectLabel>共享圆角语义阶梯</SelectLabel>
							{SEMANTIC_RADIUS_TOKENS.map((item) => (
								<SelectItem key={item.token} value={item.token}>
									<span className="flex w-full items-center justify-between gap-2">
										<span>{item.label}</span>
										<span className="font-mono text-caption text-muted-foreground">
											{item.token}
										</span>
									</span>
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>

				<div className="flex items-center justify-between gap-2 border-t pt-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						全局圆角
					</span>
					<div className="flex items-center gap-1">
						{GLOBAL_RADIUS_OPTIONS.map((opt) => (
							<Button
								key={opt.value}
								size="xs"
								variant={globalRadius === opt.value ? "secondary" : "outline"}
								onClick={() => onUpdateGlobalRadius(opt.value)}
							>
								{opt.label}
							</Button>
						))}
					</div>
				</div>
			</div>

			{/* 边框线宽语义 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						线宽语义
					</span>
					<TooltipText content={appearance.borderWidthSemanticLabel}>
						<span className="min-w-0 truncate font-semibold text-foreground text-xs">
							{appearance.borderWidthSemanticLabel}
						</span>
					</TooltipText>
				</div>

				<div className="grid grid-cols-4 gap-1">
					{(
						[
							{ label: "无", value: "0px", semantic: "无边框 (0px)" },
							{
								label: "全局",
								value: "var(--ui-border-width)",
								semantic: "全局界面线宽 (--ui-border-width)",
							},
							{ label: "1px", value: "1px", semantic: "固定 1px 细线" },
							{ label: "2px", value: "2px", semantic: "强调/选中描边 (2px)" },
						] as const
					).map((item) => (
						<Button
							key={item.label}
							size="xs"
							variant="outline"
							onClick={() => {
								if (item.value !== "0px" && appearance.borderStyle === "none") {
									onApplyElementOverride({
										cssProperty: "border-style",
										propertyLabel: "边框线型",
										beforeSemantic: "none",
										afterSemantic: "实线 (solid)",
										value: "solid",
									});
								}
								onApplyElementOverride({
									cssProperty: "border-width",
									propertyLabel: "边框线宽",
									beforeSemantic: appearance.borderWidthSemanticLabel,
									afterSemantic: item.semantic,
									value: item.value,
								});
							}}
						>
							{item.label}
						</Button>
					))}
				</div>

				<div className="flex items-center justify-between gap-2 border-t pt-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						全站线宽
					</span>
					<div className="flex items-center gap-1">
						{GLOBAL_BORDER_WIDTHS.map((w) => (
							<Button
								key={w}
								size="xs"
								variant={globalBorderWidth === w ? "secondary" : "outline"}
								onClick={() => onUpdateGlobalBorderWidth(w)}
							>
								{w}px
							</Button>
						))}
					</div>
				</div>
			</div>

			{/* 阴影层次与不透明度 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						阴影语义
					</span>
					<TooltipText content={appearance.shadowToken.label}>
						<span className="min-w-0 truncate font-semibold text-foreground text-xs">
							{appearance.shadowToken.label}
						</span>
					</TooltipText>
				</div>

				<Select
					value={appearance.shadowToken.token}
					onValueChange={(nextToken) => {
						const found = SEMANTIC_SHADOW_TOKENS.find(
							(item) => item.token === nextToken,
						);
						if (!found) return;
						onApplyElementOverride({
							cssProperty: "box-shadow",
							propertyLabel: "阴影层级语义",
							beforeSemantic: appearance.shadowToken.label,
							afterSemantic: found.label,
							value: found.cssValue,
						});
					}}
				>
					<SelectTrigger
						size="sm"
						className="w-full"
						aria-label="切换阴影层级语义"
					>
						<span className="truncate">{appearance.shadowToken.label}</span>
					</SelectTrigger>
					<SelectContent data-theme-inspector="true" align="start">
						<SelectGroup>
							<SelectLabel>共享动态阴影阶梯</SelectLabel>
							{SEMANTIC_SHADOW_TOKENS.map((item) => (
								<SelectItem key={item.token} value={item.token}>
									<span className="flex w-full items-center justify-between gap-2">
										<span>{item.label}</span>
										<span className="font-mono text-caption text-muted-foreground">
											{item.token}
										</span>
									</span>
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>

				<div className="flex flex-col gap-1.5 border-t pt-2">
					<div className="flex items-center justify-between text-caption">
						<span className="text-muted-foreground">不透明度</span>
						<span className="font-mono text-foreground">
							{appearance.opacityPercent}%
						</span>
					</div>
					<Slider
						aria-label="元素不透明度"
						min={0}
						max={100}
						step={5}
						value={[appearance.opacityPercent]}
						onValueChange={(vals) => {
							const next = Array.isArray(vals) ? (vals[0] ?? 100) : vals;
							onApplyElementOverride({
								cssProperty: "opacity",
								propertyLabel: "不透明度",
								beforeSemantic: `${appearance.opacityPercent}%`,
								afterSemantic: `${next}%`,
								value: String(Number(next) / 100),
							});
						}}
					/>
				</div>
			</div>
		</div>
	);
}
