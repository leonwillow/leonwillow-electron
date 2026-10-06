/**
 * @file 节点特殊标记编辑器与几何预览。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：复用主题编辑器的色盘、滑块和共享表单控件。
 * 被调用：node-inspector；调用：图谱标记规则与共享 UI。
 * 功能：编辑节点形状、尺寸、填色、边框及相关资金连线。
 * 预期结果：先预览再保存；取消不改图谱，恢复默认保留历史配置。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@leonwillow-electron/ui/components/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { useId, useState } from "react";
import SliderWithInput from "@/components/theme-editor/slider-with-input";
import { ColorSwatch } from "@/components/theme-editor/theme-color-panel";
import {
	lineDash,
	type NodeMark,
	validNodeMark,
} from "@/lib/funds-graph-presentation";

const shapes = [
	["circle", "圆形"],
	["rect", "方形"],
	["diamond", "菱形"],
	["triangle", "三角形"],
	["hexagon", "六边形"],
] as const;
const strokes = [
	["solid", "实线"],
	["dashed", "虚线"],
	["dotted", "点线"],
] as const;

function MarkSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: readonly (readonly [string, string])[];
	onChange: (value: string) => void;
}) {
	const id = useId();
	return (
		<Field className="gap-2">
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Select
				value={value}
				onValueChange={(v) => {
					if (v) onChange(v);
				}}
				items={options.map(([value, label]) => ({ value, label }))}
			>
				<SelectTrigger id={id} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{options.map(([id, label]) => (
							<SelectItem key={id} value={id}>
								{label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}

export default function NodeMarkEditor({
	initial,
	onSave,
	onReset,
	onCancel,
}: {
	initial: NodeMark;
	onSave: (mark: NodeMark) => void;
	onReset: () => void;
	onCancel: () => void;
}) {
	const [draft, setDraft] = useState(initial);
	const [invalid, setInvalid] = useState<Record<string, boolean>>({});
	const change = <K extends keyof NodeMark>(key: K, value: NodeMark[K]) =>
		setDraft((old) => ({ ...old, [key]: value }));
	const colorField = (key: "fill" | "stroke" | "edgeColor", label: string) => (
		<ColorSwatch
			label={label}
			value={draft[key]}
			onChange={(value) => change(key, value)}
			onValidityChange={(valid) =>
				setInvalid((old) => ({ ...old, [key]: !valid }))
			}
		/>
	);
	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				if (validNodeMark(draft) && !Object.values(invalid).some(Boolean))
					onSave(draft);
			}}
		>
			<div className="rounded-lg bg-muted/30 p-3">
				<svg
					viewBox="0 0 320 120"
					className="h-28 w-full"
					role="img"
					aria-label="特殊标记预览"
				>
					<title>节点及相关连线的样式预览</title>
					<path
						d="M 24 60 L 280 60"
						stroke={
							draft.edgeScope === "none"
								? "var(--muted-foreground)"
								: draft.edgeColor
						}
						strokeWidth={draft.edgeWidth}
						strokeDasharray={lineDash(draft.edgeDash).join(" ")}
					/>
					<path
						d="M 274 54 L 282 60 L 274 66"
						fill="none"
						stroke={
							draft.edgeScope === "none"
								? "var(--muted-foreground)"
								: draft.edgeColor
						}
						strokeWidth={draft.edgeWidth}
					/>
					<g
						transform={`translate(160 60) scale(${draft.size / 100})`}
						fill={draft.fill}
						stroke={draft.stroke}
						strokeWidth={draft.borderWidth}
						strokeDasharray={lineDash(draft.borderDash).join(" ")}
					>
						{draft.shape === "circle" ? (
							<circle r="20" />
						) : draft.shape === "rect" ? (
							<rect x="-20" y="-20" width="40" height="40" rx="4" />
						) : (
							<polygon
								points={
									draft.shape === "triangle"
										? "0,-20 20,20 -20,20"
										: draft.shape === "diamond"
											? "0,-20 20,0 0,20 -20,0"
											: "-20,0 -10,-17 10,-17 20,0 10,17 -10,17"
								}
							/>
						)}
					</g>
				</svg>
				<p className="text-center text-muted-foreground text-xs">
					预览 · 保存后应用到图谱
				</p>
			</div>
			<FieldSet>
				<FieldLegend>节点图形</FieldLegend>
				<FieldGroup className="gap-4">
					<MarkSelect
						label="图形样式"
						value={draft.shape}
						options={shapes}
						onChange={(v) => change("shape", v as NodeMark["shape"])}
					/>
					<SliderWithInput
						label="图形大小"
						min={60}
						max={240}
						step={10}
						unit="%"
						value={draft.size}
						onChange={(v) => change("size", v)}
					/>
					{colorField("fill", "图形颜色")}
					{colorField("stroke", "边框颜色")}
					<MarkSelect
						label="边框样式"
						value={draft.borderDash}
						options={strokes}
						onChange={(v) => change("borderDash", v as NodeMark["borderDash"])}
					/>
					<SliderWithInput
						label="边框粗细"
						min={0.5}
						max={6}
						step={0.5}
						unit=""
						value={draft.borderWidth}
						onChange={(v) => change("borderWidth", v)}
					/>
				</FieldGroup>
			</FieldSet>
			<FieldSet>
				<FieldLegend>关联资金连线</FieldLegend>
				<FieldGroup className="gap-4">
					<MarkSelect
						label="连线应用范围"
						value={draft.edgeScope}
						options={[
							["both", "全部关联连线"],
							["out", "仅资金流出"],
							["in", "仅资金流入"],
							["none", "仅标记节点"],
						]}
						onChange={(v) => change("edgeScope", v as NodeMark["edgeScope"])}
					/>
					{draft.edgeScope !== "none" && (
						<>
							{colorField("edgeColor", "线条颜色")}
							<MarkSelect
								label="线条样式"
								value={draft.edgeDash}
								options={strokes}
								onChange={(v) => change("edgeDash", v as NodeMark["edgeDash"])}
							/>
							<SliderWithInput
								label="线条粗细"
								min={0.5}
								max={6}
								step={0.5}
								unit=""
								value={draft.edgeWidth}
								onChange={(v) => change("edgeWidth", v)}
							/>
						</>
					)}
				</FieldGroup>
			</FieldSet>
			<p className="text-muted-foreground text-xs">
				同一条连线被两端标记时，以最后保存且方向适用的设置为准。标记保存在当前浏览器，按用户、案件和节点模式区分。
			</p>
			<div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background py-3">
				<Button type="submit" disabled={Object.values(invalid).some(Boolean)}>
					保存标记
				</Button>
				<Button type="button" variant="outline" onClick={onCancel}>
					取消
				</Button>
				<Button type="button" variant="ghost" onClick={onReset}>
					恢复默认样式
				</Button>
			</div>
		</form>
	);
}
