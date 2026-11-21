/**
 * @file 主题分析面板的「变更记录（Changes）」汇总、单条撤销与保存主题表单。
 * 创建时间：2026-11-21
 * 修改时间：2026-11-21
 * 版本作用：紧凑呈现本次分析的全局语义令牌、单元素语义参数与文案内容修改，支持逐条撤销及保存为自定义主题。
 * 被调用：components/theme-inspector/theme-inspector.tsx。
 * 调用：ui Badge/Button/Input/Field、lucide-react。
 * 功能：分组汇总三类变更、定位对应元素、单项还原、全部重置与保存主题。
 * 预期结果：全局语义改动可落盘至自定义主题库，元素样式与文案调整可清晰回溯并导出。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { Field, FieldLabel } from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { RotateCcwIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import type { ThemeStyleProps } from "@/types/theme";
import type {
	ElementOverrideItem,
	ElementTextOverrideItem,
	GlobalTokenChangeItem,
} from "./theme-inspector-types";

type InspectorChangesTabProps = {
	tokenChanges: GlobalTokenChangeItem[];
	elementOverrides: ElementOverrideItem[];
	textOverrides: ElementTextOverrideItem[];
	defaultThemeName: string;
	canOverwriteCurrent: boolean;
	onRevertGlobalToken: (
		mode: "light" | "dark",
		key: keyof ThemeStyleProps,
	) => void;
	onRevertElementOverride: (id: string) => void;
	onRevertTextOverride: (id: string) => void;
	onFocusElement: (element: HTMLElement) => void;
	onSaveTheme: (label: string, saveAsCopy: boolean) => void;
	onResetAll: () => void;
};

export function InspectorChangesTab({
	tokenChanges,
	elementOverrides,
	textOverrides,
	defaultThemeName,
	canOverwriteCurrent,
	onRevertGlobalToken,
	onRevertElementOverride,
	onRevertTextOverride,
	onFocusElement,
	onSaveTheme,
	onResetAll,
}: InspectorChangesTabProps) {
	const [themeName, setThemeName] = useState(defaultThemeName);
	const totalCount =
		tokenChanges.length + elementOverrides.length + textOverrides.length;

	if (totalCount === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground text-xs">
				<SparklesIcon className="size-5 opacity-45" aria-hidden="true" />
				<p>暂无修改记录</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3.5 p-3">
			<div className="flex items-center justify-between gap-2">
				<span className="font-medium text-muted-foreground text-xs">
					共 {totalCount} 项修改
				</span>
				<Button size="xs" variant="destructive" onClick={onResetAll}>
					<RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
					全部还原
				</Button>
			</div>

			{tokenChanges.length > 0 && (
				<section className="flex flex-col gap-2">
					<h4 className="font-semibold text-foreground text-xs">
						全局语义令牌 ({tokenChanges.length})
					</h4>
					<ul className="flex flex-col gap-1.5">
						{tokenChanges.map((item) => (
							<li
								key={`${item.mode}:${item.styleKey}`}
								className="flex items-start justify-between gap-2 rounded-lg border bg-background/60 p-2"
							>
								<div className="min-w-0 flex-1 space-y-0.5">
									<div className="flex flex-wrap items-center gap-1.5">
										<span className="font-medium text-foreground text-xs">
											{item.semanticLabel}
										</span>
										<Badge variant="outline" className="font-mono text-caption">
											--{item.styleKey}
										</Badge>
									</div>
									<p className="truncate font-mono text-caption text-muted-foreground">
										{item.beforeValue || "默认"} →{" "}
										<span className="text-foreground">{item.afterValue}</span>
									</p>
								</div>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label={`撤销 ${item.semanticLabel} 修改`}
									onClick={() => onRevertGlobalToken(item.mode, item.styleKey)}
								>
									<RotateCcwIcon aria-hidden="true" />
								</Button>
							</li>
						))}
					</ul>

					<div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
						<Field className="gap-1">
							<FieldLabel htmlFor="inspector-save-theme-name">
								保存为自定义主题
							</FieldLabel>
							<Input
								id="inspector-save-theme-name"
								size="sm"
								value={themeName}
								placeholder="输入主题名称"
								onChange={(e) => setThemeName(e.target.value)}
							/>
						</Field>
						<div className="flex flex-wrap gap-1.5">
							{canOverwriteCurrent && (
								<Button
									size="sm"
									variant="default"
									disabled={!themeName.trim()}
									onClick={() => onSaveTheme(themeName.trim(), false)}
								>
									<SaveIcon data-icon="inline-start" aria-hidden="true" />
									更新主题
								</Button>
							)}
							<Button
								size="sm"
								variant={canOverwriteCurrent ? "outline" : "default"}
								disabled={!themeName.trim()}
								onClick={() => onSaveTheme(themeName.trim(), true)}
							>
								<SaveIcon data-icon="inline-start" aria-hidden="true" />
								另存为新主题
							</Button>
						</div>
					</div>
				</section>
			)}

			{textOverrides.length > 0 && (
				<section className="flex flex-col gap-2">
					<h4 className="font-semibold text-foreground text-xs">
						文案内容 ({textOverrides.length})
					</h4>
					<ul className="flex flex-col gap-1.5">
						{textOverrides.map((item) => (
							<li
								key={item.id}
								className="flex items-start justify-between gap-2 rounded-lg border bg-background/60 p-2"
							>
								<button
									type="button"
									onClick={() => onFocusElement(item.element)}
									className="min-w-0 flex-1 space-y-0.5 text-left"
								>
									<span className="block truncate font-medium text-foreground text-xs">
										{item.elementLabel}
									</span>
									<p className="truncate text-caption text-muted-foreground">
										“{item.originalText}” →{" "}
										<span className="font-medium text-foreground">
											“{item.currentText}”
										</span>
									</p>
								</button>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label={`还原 ${item.elementLabel} 的文案内容`}
									onClick={() => onRevertTextOverride(item.id)}
								>
									<RotateCcwIcon aria-hidden="true" />
								</Button>
							</li>
						))}
					</ul>
				</section>
			)}

			{elementOverrides.length > 0 && (
				<section className="flex flex-col gap-2">
					<h4 className="font-semibold text-foreground text-xs">
						元素语义与参数 ({elementOverrides.length})
					</h4>
					<ul className="flex flex-col gap-1.5">
						{elementOverrides.map((item) => (
							<li
								key={item.id}
								className="flex items-start justify-between gap-2 rounded-lg border bg-background/60 p-2"
							>
								<button
									type="button"
									onClick={() => onFocusElement(item.element)}
									className="min-w-0 flex-1 space-y-0.5 text-left"
								>
									<div className="flex min-w-0 items-center gap-1.5">
										<span className="truncate font-medium text-foreground text-xs">
											{item.elementLabel}
										</span>
										<span className="shrink-0 text-caption text-muted-foreground">
											· {item.propertyLabel}
										</span>
									</div>
									<p className="truncate font-mono text-caption text-muted-foreground">
										{item.beforeSemantic} →{" "}
										<span className="font-medium text-foreground">
											{item.afterSemantic}
										</span>
									</p>
								</button>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label={`撤销 ${item.elementLabel} 的 ${item.propertyLabel} 修改`}
									onClick={() => onRevertElementOverride(item.id)}
								>
									<RotateCcwIcon aria-hidden="true" />
								</Button>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
