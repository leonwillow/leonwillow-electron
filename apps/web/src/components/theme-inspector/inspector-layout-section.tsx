/**
 * @file 主题分析面板的「布局、控件尺寸与间距语义」展示与编辑分区。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：优先展示控件尺寸语义、布局模式、3×3 子项对齐矩阵与间距步进语义，所有长语义单行截断且悬停可看全文。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：ui Badge/Button/Input/Select/TooltipText、lucide-react、utils/theme/semantic-catalog。
 * 功能：切换控件高度语义、布局排布与九宫格对齐、间隙与四向内外边距。
 * 预期结果：标签不挤换行、超长语义优雅截断，所有调整即时反映到画布与测距标尺。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@leonwillow-electron/ui/components/select";
import { TooltipText } from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	Columns2Icon,
	LayoutGridIcon,
	Rows2Icon,
	SquareIcon,
} from "lucide-react";
import { useState } from "react";
import {
	SEMANTIC_CONTROL_SIZE_TOKENS,
	SEMANTIC_SPACING_TOKENS,
} from "@/utils/theme/semantic-catalog";
import type { InspectedLayout } from "./theme-inspector-types";

type InspectorLayoutSectionProps = {
	layout: InspectedLayout;
	onApplyElementOverride: (params: {
		cssProperty: string;
		propertyLabel: string;
		beforeSemantic: string;
		afterSemantic: string;
		value: string;
	}) => void;
};

const QUICK_SPACING_CHIPS = [
	{ token: "0", label: "0", cssValue: "0px" },
	{ token: "1", label: "4px", cssValue: "0.25rem" },
	{ token: "2", label: "8px", cssValue: "0.5rem" },
	{
		token: "workspace-gutter",
		label: "gutter",
		cssValue: "var(--spacing-workspace-gutter)",
	},
	{ token: "4", label: "16px", cssValue: "1rem" },
	{ token: "6", label: "24px", cssValue: "1.5rem" },
] as const;

const ALIGN_MATRIX = [
	{ justify: "flex-start", align: "flex-start", label: "左上" },
	{ justify: "center", align: "flex-start", label: "中上" },
	{ justify: "flex-end", align: "flex-start", label: "右上" },
	{ justify: "flex-start", align: "center", label: "左中" },
	{ justify: "center", align: "center", label: "正中" },
	{ justify: "flex-end", align: "center", label: "右中" },
	{ justify: "flex-start", align: "flex-end", label: "左下" },
	{ justify: "center", align: "flex-end", label: "中下" },
	{ justify: "flex-end", align: "flex-end", label: "右下" },
] as const;

export function InspectorLayoutSection({
	layout,
	onApplyElementOverride,
}: InspectorLayoutSectionProps) {
	const [boxSideTab, setBoxSideTab] = useState<"padding" | "margin">("padding");
	const [spacingInput, setSpacingInput] = useState<{
		top: string;
		right: string;
		bottom: string;
		left: string;
	} | null>(null);

	const activeBox = boxSideTab === "padding" ? layout.padding : layout.margin;
	const activeBoxLabel = boxSideTab === "padding" ? "内边距" : "外边距";
	const activeBoxSummary =
		boxSideTab === "padding"
			? layout.paddingSemanticSummary
			: layout.marginSemanticSummary;

	const isFlex = layout.display === "flex" || layout.display === "inline-flex";
	const isGrid = layout.display === "grid" || layout.display === "inline-grid";
	const isColumn = isFlex && layout.flexDirection.startsWith("column");

	const applyUniformBox = (cssValue: string, semanticLabel: string) => {
		setSpacingInput(null);
		onApplyElementOverride({
			cssProperty: boxSideTab,
			propertyLabel: activeBoxLabel,
			beforeSemantic: activeBoxSummary,
			afterSemantic: semanticLabel,
			value: cssValue,
		});
	};

	const applySingleSide = (
		side: "top" | "right" | "bottom" | "left",
		raw: string,
	) => {
		const trimmed = raw.trim();
		if (!trimmed) return;
		const normalized = /^-?\d+(?:\.\d+)?$/.test(trimmed)
			? `${trimmed}px`
			: trimmed;
		const sideZh =
			side === "top"
				? "上"
				: side === "right"
					? "右"
					: side === "bottom"
						? "下"
						: "左";
		onApplyElementOverride({
			cssProperty: `${boxSideTab}-${side}`,
			propertyLabel: `${activeBoxLabel}（${sideZh}）`,
			beforeSemantic: `${activeBox[side]}px`,
			afterSemantic: `${sideZh} ${normalized}`,
			value: normalized,
		});
	};

	const currentControlKey = layout.controlSizeToken?.token ?? "__auto__";
	const currentGapKey = layout.gapSemantic?.token ?? "__custom__";

	return (
		<div className="flex flex-col gap-2.5">
			{/* 控件尺寸语义 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<span className="shrink-0 text-caption text-muted-foreground">
							尺寸语义
						</span>
						<TooltipText content={layout.controlSizeLabel}>
							<span className="min-w-0 truncate font-semibold text-foreground text-xs">
								{layout.controlSizeLabel}
							</span>
						</TooltipText>
					</div>
					<Badge variant="outline" className="shrink-0 font-mono text-caption">
						{Math.round(layout.widthPx)}×{Math.round(layout.heightPx)}
					</Badge>
				</div>

				<Select
					value={currentControlKey}
					onValueChange={(nextToken) => {
						if (nextToken === "__auto__") {
							onApplyElementOverride({
								cssProperty: "height",
								propertyLabel: "高度语义",
								beforeSemantic: layout.controlSizeLabel,
								afterSemantic: "自适应 (auto)",
								value: "auto",
							});
							return;
						}
						const found = SEMANTIC_CONTROL_SIZE_TOKENS.find(
							(item) => item.token === nextToken,
						);
						if (!found) return;
						onApplyElementOverride({
							cssProperty: "height",
							propertyLabel: "控件高度语义",
							beforeSemantic: layout.controlSizeLabel,
							afterSemantic: found.label,
							value: found.cssValue,
						});
					}}
				>
					<SelectTrigger
						size="sm"
						className="w-full"
						aria-label="切换控件高度语义"
					>
						<span className="truncate">{layout.controlSizeLabel}</span>
					</SelectTrigger>
					<SelectContent data-theme-inspector="true" align="start">
						<SelectGroup>
							<SelectLabel>工作台控件高度令牌</SelectLabel>
							<SelectItem value="__auto__">自适应高度（auto）</SelectItem>
							{SEMANTIC_CONTROL_SIZE_TOKENS.map((item) => (
								<SelectItem key={item.token} value={item.token}>
									<span className="flex w-full items-center justify-between gap-2">
										<span>{item.label}</span>
										<span className="font-mono text-caption text-muted-foreground">
											{item.rem}rem
										</span>
									</span>
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>

			{/* 布局排布与间距语义 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex items-center justify-between gap-2">
					<span className="shrink-0 text-caption text-muted-foreground">
						布局语义
					</span>
					<TooltipText content={layout.displaySemantic}>
						<span className="min-w-0 truncate font-semibold text-foreground text-xs">
							{layout.displaySemantic}
						</span>
					</TooltipText>
				</div>

				<div className="grid grid-cols-4 gap-1">
					{(
						[
							{
								key: "block",
								label: "块级",
								active: layout.display === "block",
								icon: SquareIcon,
								apply: () =>
									onApplyElementOverride({
										cssProperty: "display",
										propertyLabel: "布局模式",
										beforeSemantic: layout.displaySemantic,
										afterSemantic: "块级容器 (block)",
										value: "block",
									}),
							},
							{
								key: "flex-row",
								label: "横排",
								active: isFlex && !isColumn,
								icon: Columns2Icon,
								apply: () => {
									onApplyElementOverride({
										cssProperty: "display",
										propertyLabel: "布局模式",
										beforeSemantic: layout.displaySemantic,
										afterSemantic: "横向弹性布局 (flex-row)",
										value: "flex",
									});
									onApplyElementOverride({
										cssProperty: "flex-direction",
										propertyLabel: "排列方向",
										beforeSemantic: layout.flexDirection,
										afterSemantic: "横向 (row)",
										value: "row",
									});
								},
							},
							{
								key: "flex-col",
								label: "竖排",
								active: isColumn,
								icon: Rows2Icon,
								apply: () => {
									onApplyElementOverride({
										cssProperty: "display",
										propertyLabel: "布局模式",
										beforeSemantic: layout.displaySemantic,
										afterSemantic: "纵向弹性布局 (flex-col)",
										value: "flex",
									});
									onApplyElementOverride({
										cssProperty: "flex-direction",
										propertyLabel: "排列方向",
										beforeSemantic: layout.flexDirection,
										afterSemantic: "纵向 (column)",
										value: "column",
									});
								},
							},
							{
								key: "grid",
								label: "网格",
								active: isGrid,
								icon: LayoutGridIcon,
								apply: () =>
									onApplyElementOverride({
										cssProperty: "display",
										propertyLabel: "布局模式",
										beforeSemantic: layout.displaySemantic,
										afterSemantic: "网格布局 (grid)",
										value: "grid",
									}),
							},
						] as const
					).map(({ key, label, active, icon: Icon, apply }) => (
						<Button
							key={key}
							size="xs"
							variant={active ? "secondary" : "outline"}
							onClick={apply}
							aria-label={`切换为${label}布局`}
						>
							<Icon data-icon="inline-start" aria-hidden="true" />
							{label}
						</Button>
					))}
				</div>

				{(isFlex || isGrid) && (
					<div className="grid grid-cols-[auto_1fr] items-start gap-2.5 border-t pt-2">
						<div className="flex flex-col gap-1">
							<span className="text-caption text-muted-foreground">对齐</span>
							<fieldset
								aria-label="子项九宫格对齐"
								className="m-0 grid grid-cols-3 gap-1 rounded-md border bg-muted/40 p-1"
							>
								{ALIGN_MATRIX.map((cell) => {
									const matchJustify =
										layout.justifyContent === cell.justify ||
										(cell.justify === "flex-start" &&
											(layout.justifyContent === "normal" ||
												layout.justifyContent === "start"));
									const matchAlign =
										layout.alignItems === cell.align ||
										(cell.align === "flex-start" &&
											(layout.alignItems === "normal" ||
												layout.alignItems === "start" ||
												layout.alignItems === "stretch"));
									const active = matchJustify && matchAlign;
									return (
										<button
											key={cell.label}
											type="button"
											aria-label={`子项对齐：${cell.label}`}
											onClick={() => {
												onApplyElementOverride({
													cssProperty: "justify-content",
													propertyLabel: "主轴对齐",
													beforeSemantic: layout.justifyContent,
													afterSemantic: `${cell.label} (${cell.justify})`,
													value: cell.justify,
												});
												onApplyElementOverride({
													cssProperty: "align-items",
													propertyLabel: "交叉轴对齐",
													beforeSemantic: layout.alignItems,
													afterSemantic: `${cell.label} (${cell.align})`,
													value: cell.align,
												});
											}}
											className={cn(
												"flex size-5 items-center justify-center rounded-xs transition-colors",
												active
													? "bg-primary text-primary-foreground"
													: "text-muted-foreground hover:bg-muted hover:text-foreground",
											)}
										>
											<span className="size-1.5 rounded-full bg-current" />
										</button>
									);
								})}
							</fieldset>
						</div>

						<div className="flex min-w-0 flex-col gap-1.5">
							<div className="flex items-center justify-between gap-1 text-caption">
								<span className="text-muted-foreground">子项间距</span>
								<span className="font-mono text-foreground">
									{layout.gapPx}px
								</span>
							</div>
							<Select
								value={currentGapKey}
								onValueChange={(nextToken) => {
									const found = SEMANTIC_SPACING_TOKENS.find(
										(item) => item.token === nextToken,
									);
									if (!found) return;
									onApplyElementOverride({
										cssProperty: "gap",
										propertyLabel: "子项间距语义",
										beforeSemantic:
											layout.gapSemantic?.label ?? `${layout.gapPx}px`,
										afterSemantic: found.label,
										value: found.cssValue,
									});
								}}
							>
								<SelectTrigger
									size="sm"
									className="w-full"
									aria-label="选择子项间距语义"
								>
									<span className="truncate">
										{layout.gapSemantic?.label ?? `自定义 (${layout.gapPx}px)`}
									</span>
								</SelectTrigger>
								<SelectContent data-theme-inspector="true" align="start">
									<SelectGroup>
										<SelectLabel>工作区标准间距步进</SelectLabel>
										{SEMANTIC_SPACING_TOKENS.map((item) => (
											<SelectItem key={item.token} value={item.token}>
												<span className="flex w-full items-center justify-between gap-2">
													<span>{item.label}</span>
													<span className="font-mono text-caption text-muted-foreground">
														{item.rem}rem
													</span>
												</span>
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</div>
				)}
			</div>

			{/* 盒模型留白语义：分段按钮严禁换行，右侧长语义单行截断+悬浮全文 */}
			<div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<div className="inline-flex shrink-0 rounded-md border bg-muted/40 p-0.5">
						<button
							type="button"
							onClick={() => {
								setBoxSideTab("padding");
								setSpacingInput(null);
							}}
							className={cn(
								"whitespace-nowrap rounded-sm px-2 py-0.5 text-caption transition-colors",
								boxSideTab === "padding"
									? "bg-card font-medium text-foreground shadow-2xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							内边距
						</button>
						<button
							type="button"
							onClick={() => {
								setBoxSideTab("margin");
								setSpacingInput(null);
							}}
							className={cn(
								"whitespace-nowrap rounded-sm px-2 py-0.5 text-caption transition-colors",
								boxSideTab === "margin"
									? "bg-card font-medium text-foreground shadow-2xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							外边距
						</button>
					</div>
					<TooltipText content={activeBoxSummary}>
						<span className="min-w-0 flex-1 truncate text-right font-medium text-caption text-foreground">
							{activeBoxSummary}
						</span>
					</TooltipText>
				</div>

				<div className="flex flex-wrap gap-1">
					{QUICK_SPACING_CHIPS.map((chip) => (
						<Button
							key={chip.token}
							size="xs"
							variant="outline"
							onClick={() =>
								applyUniformBox(chip.cssValue, `四向统一 · ${chip.label}`)
							}
						>
							{chip.label}
						</Button>
					))}
				</div>

				<div className="grid grid-cols-4 gap-1.5">
					{(
						[
							{ side: "top", label: "上" },
							{ side: "right", label: "右" },
							{ side: "bottom", label: "下" },
							{ side: "left", label: "左" },
						] as const
					).map(({ side, label }) => {
						const val = spacingInput?.[side] ?? String(activeBox[side]);
						return (
							<div key={side} className="flex flex-col gap-0.5">
								<span className="text-center text-caption text-muted-foreground">
									{label}
								</span>
								<Input
									size="sm"
									aria-label={`${activeBoxLabel}${label}`}
									value={val}
									onChange={(e) => {
										const nextVal = e.target.value;
										setSpacingInput((prev) => ({
											top: prev?.top ?? String(activeBox.top),
											right: prev?.right ?? String(activeBox.right),
											bottom: prev?.bottom ?? String(activeBox.bottom),
											left: prev?.left ?? String(activeBox.left),
											[side]: nextVal,
										}));
									}}
									onBlur={(e) => {
										applySingleSide(side, e.target.value);
										setSpacingInput(null);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											applySingleSide(side, e.currentTarget.value);
											setSpacingInput(null);
										}
									}}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
