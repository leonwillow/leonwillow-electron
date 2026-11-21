/**
 * @file 笔录基础信息、被询问人和询问人表单。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：将基本情况、询问（调查）人与被询问（调查）人组织为可独立折叠的分组，并将询问日期与询问次数并排展示。
 * 被调用：RecordEditor；调用：常用询问人接口、时间适配、年龄纯函数、共享 Accordion 与表单控件。
 * 预期结果：三组信息支持自由折叠及文书定位自动展开，日期与次数同行且日期优先占宽，只读模式下仍可折叠查阅。
 */
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@leonwillow-electron/ui/components/accordion";
import { Button } from "@leonwillow-electron/ui/components/button";
import { DatePicker } from "@leonwillow-electron/ui/components/date-picker";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import { Label } from "@leonwillow-electron/ui/components/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@leonwillow-electron/ui/components/radio-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { TimePicker } from "@leonwillow-electron/ui/components/time-picker";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { AsyncStatusBlock } from "@/components/layout/async-state";
import { useAsyncResource } from "@/hooks/use-async-resource";
import type { InquiryContent } from "@/lib/inquiries";
import { listInquiryInquirers } from "@/lib/inquiries";
import {
	changeInquiryDate,
	changeInquiryEndTime,
	changeInquiryStartTime,
	minimumInquiryEndTime,
	readInquirySchedule,
} from "@/lib/inquiry-schedule";
import {
	emptyInquirer,
	idTypes,
	inquiryRelationshipName,
	relationships,
} from "./record-fields";
import { calculateSubjectAge } from "./subject-age";

export type BasicSectionKey = "basic" | "inquirers" | "subject";

export const DEFAULT_BASIC_SECTIONS: readonly BasicSectionKey[] = [
	"basic",
	"inquirers",
	"subject",
];

/** 将文书预览定位目标 ID 映射到所属基础信息折叠分组。 */
export function sectionForBasicField(id: string): BasicSectionKey | null {
	if (id.startsWith("inquiry-subject")) return "subject";
	if (
		id.startsWith("inquirer-") ||
		id.startsWith("recorder-") ||
		id.startsWith("frequent-")
	) {
		return "inquirers";
	}
	if (id.startsWith("inquiry-")) return "basic";
	return null;
}

function InquirySelect({
	label,
	value,
	options,
	onChange,
	id,
}: {
	label: string;
	value: string;
	options: string[];
	onChange: (value: string) => void;
	id: string;
}) {
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Select
				value={value}
				onValueChange={(v) => {
					if (v !== null) onChange(v);
				}}
			>
				<SelectTrigger id={id} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{options.map((option) => (
							<SelectItem key={option} value={option}>
								{option}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
const InquiryBasicFields = memo(
	function InquiryBasicFields({
		content: c,
		onChange,
		readOnly,
		openSections,
		onOpenSectionsChange,
	}: {
		content: InquiryContent;
		onChange: (value: InquiryContent) => void;
		readOnly: boolean;
		openSections?: BasicSectionKey[];
		onOpenSectionsChange?: (sections: BasicSectionKey[]) => void;
	}) {
		const frequent = useAsyncResource(listInquiryInquirers, {
			fallbackError: "无法连接笔录服务，请稍后重试。",
			keepPreviousOnReload: true,
		});
		const [countText, setCountText] = useState(() => String(c.inquiryCount));
		useEffect(() => {
			setCountText(String(c.inquiryCount));
		}, [c.inquiryCount]);
		const schedule = readInquirySchedule(c);
		const updateSchedule = (
			times: Pick<InquiryContent, "inquiryStartAt" | "inquiryEndAt">,
		) => {
			const next = { ...c, ...times };
			next.subjectAge = calculateSubjectAge(
				next.inquiryStartAt.slice(0, 10),
				next.subjectIdType,
				next.subjectIdNumber,
			);
			next.subjectRelationship = inquiryRelationshipName(
				next.subjectRelationship,
			);
			onChange(next);
		};
		const update = <K extends keyof InquiryContent>(
			key: K,
			value: InquiryContent[K],
		) => {
			const next = { ...c, [key]: value };
			next.subjectRelationship = inquiryRelationshipName(
				next.subjectRelationship,
			);
			if (["inquiryStartAt", "subjectIdType", "subjectIdNumber"].includes(key))
				next.subjectAge = calculateSubjectAge(
					next.inquiryStartAt.slice(0, 10),
					next.subjectIdType,
					next.subjectIdNumber,
				);
			if (key === "subjectRelationship" && value !== "其他")
				next.subjectRelationshipOther = "";
			onChange(next);
		};
		const field = (
			key: keyof InquiryContent,
			label: string,
			type = "text",
			maxLength = 200,
		) => (
			<Field key={key}>
				<FieldLabel htmlFor={`inquiry-${key}`}>{label}</FieldLabel>
				<Input
					id={`inquiry-${key}`}
					type={type}
					maxLength={maxLength}
					value={String(c[key])}
					onChange={(e) => update(key, e.target.value)}
				/>
			</Field>
		);
		const subjectSummary = c.subjectName.trim();
		const accordionProps =
			openSections !== undefined && onOpenSectionsChange
				? {
						value: openSections,
						onValueChange: (value: unknown[]) =>
							onOpenSectionsChange(value as BasicSectionKey[]),
					}
				: { defaultValue: [...DEFAULT_BASIC_SECTIONS] };

		return (
			<Accordion
				multiple
				hiddenUntilFound
				{...accordionProps}
				className="overflow-visible rounded-none border-0"
			>
				<AccordionItem
					value="basic"
					className="not-last:border-b data-open:bg-transparent"
				>
					<AccordionTrigger className="cursor-pointer items-center gap-2 px-0 pt-0.5 pb-2.5 font-medium text-foreground text-sm hover:no-underline">
						<span className="truncate">基本情况</span>
					</AccordionTrigger>
					<AccordionContent className="px-0 pt-1 pb-4">
						<fieldset disabled={readOnly} className="min-w-0">
							<FieldGroup>
								{field("enforcementUnitName", "执法单位名称")}
								<FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,5rem)] gap-3">
									<Field className="min-w-0">
										<FieldLabel htmlFor="inquiry-date">询问日期</FieldLabel>
										<DatePicker
											id="inquiry-date"
											aria-label="询问日期"
											value={schedule.date}
											disabled={readOnly}
											onValueChange={(date) =>
												updateSchedule(changeInquiryDate(c, date))
											}
										/>
									</Field>
									<Field className="min-w-0">
										<FieldLabel htmlFor="inquiry-inquiryCount">
											询问次数
										</FieldLabel>
										<Input
											id="inquiry-inquiryCount"
											type="number"
											min={1}
											max={9999}
											value={countText}
											onChange={(e) => {
												const text = e.target.value;
												setCountText(text);
												if (!text.trim()) return;
												const parsed = Math.trunc(Number(text));
												if (Number.isFinite(parsed) && parsed >= 1) {
													update("inquiryCount", Math.min(9999, parsed));
												}
											}}
											onBlur={() => {
												const parsed = Math.trunc(Number(countText));
												const clamped =
													Number.isFinite(parsed) && parsed >= 1
														? Math.min(9999, parsed)
														: Math.max(1, Math.min(9999, c.inquiryCount || 1));
												if (clamped !== c.inquiryCount) {
													update("inquiryCount", clamped);
												}
												setCountText(String(clamped));
											}}
										/>
									</Field>
								</FieldGroup>
								<FieldGroup className="grid grid-cols-2 gap-3">
									<Field className="min-w-0">
										<FieldLabel htmlFor="inquiry-inquiryStartAt">
											开始时间
										</FieldLabel>
										<TimePicker
											id="inquiry-inquiryStartAt"
											aria-label="开始时间"
											value={schedule.startTime || null}
											onValueChange={(time) =>
												updateSchedule(changeInquiryStartTime(c, time ?? ""))
											}
											minuteStep={1}
											max={
												schedule.endDate && schedule.endDate !== schedule.date
													? undefined
													: "23:58"
											}
											disabled={readOnly || !schedule.date}
										/>
									</Field>
									<Field className="min-w-0">
										<FieldLabel htmlFor="inquiry-inquiryEndAt">
											结束时间
										</FieldLabel>
										<TimePicker
											id="inquiry-inquiryEndAt"
											aria-label="结束时间"
											value={schedule.endTime || null}
											onValueChange={(time) =>
												updateSchedule(changeInquiryEndTime(c, time ?? ""))
											}
											minuteStep={1}
											min={minimumInquiryEndTime(c)}
											disabled={readOnly || !schedule.date}
										/>
										{schedule.endTime && schedule.endDate !== schedule.date && (
											<FieldDescription>
												结束日期：{schedule.endDate}
											</FieldDescription>
										)}
									</Field>
								</FieldGroup>
								{field("inquiryLocation", "询问地点", "text", 500)}
							</FieldGroup>
						</fieldset>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem
					value="inquirers"
					className="not-last:border-b data-open:bg-transparent"
				>
					<AccordionTrigger className="cursor-pointer items-center gap-2 px-0 py-2.5 font-medium text-foreground text-sm hover:no-underline">
						<span className="truncate">询问（调查）人</span>
						<span className="shrink-0 font-normal text-muted-foreground text-xs">
							{c.inquirers.length} 人
						</span>
					</AccordionTrigger>
					<AccordionContent className="px-0 pt-1 pb-4">
						<fieldset
							disabled={readOnly}
							className="flex min-w-0 flex-col gap-3"
						>
							<FieldDescription>
								至少两人，并从中选择一位记录人。
							</FieldDescription>
							<AsyncStatusBlock
								compact
								loading={false}
								error={frequent.error}
								onRetry={frequent.reload}
							/>
							<RadioGroup
								aria-label="选择记录人"
								value={c.inquirers.find((p) => p.isRecorder)?.id ?? ""}
								onValueChange={(value) =>
									update(
										"inquirers",
										c.inquirers.map((p) => ({
											...p,
											isRecorder: p.id === value,
										})),
									)
								}
							>
								{c.inquirers.map((person, i) => (
									<div
										key={person.id}
										className="flex flex-col gap-3 rounded-lg border p-3"
									>
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor={`recorder-${person.id}`}>
												<RadioGroupItem
													id={`recorder-${person.id}`}
													value={person.id}
												/>
												第 {i + 1} 位 · 记录人
											</Label>
											<TooltipIconButton
												label={`删除第 ${i + 1} 位询问人`}
												variant="destructive"
												disabled={readOnly || c.inquirers.length <= 2}
												disabledReason={
													readOnly
														? "当前笔录不可编辑"
														: "询问人至少保留两位，不能继续删除"
												}
												onClick={() =>
													update(
														"inquirers",
														c.inquirers.filter((p) => p.id !== person.id),
													)
												}
											>
												<Trash2Icon />
											</TooltipIconButton>
										</div>
										<FieldGroup>
											<Field>
												<FieldLabel htmlFor={`inquirer-name-${person.id}`}>
													姓名
												</FieldLabel>
												<Input
													id={`inquirer-name-${person.id}`}
													maxLength={80}
													value={person.name}
													onChange={(e) =>
														update(
															"inquirers",
															c.inquirers.map((p) =>
																p.id === person.id
																	? { ...p, name: e.target.value }
																	: p,
															),
														)
													}
												/>
											</Field>
											<Field>
												<FieldLabel htmlFor={`inquirer-badge-${person.id}`}>
													检查证号
												</FieldLabel>
												<Input
													id={`inquirer-badge-${person.id}`}
													maxLength={80}
													value={person.badgeNumber}
													onChange={(e) =>
														update(
															"inquirers",
															c.inquirers.map((p) =>
																p.id === person.id
																	? { ...p, badgeNumber: e.target.value }
																	: p,
															),
														)
													}
												/>
											</Field>
											{(frequent.data?.length ?? 0) > 0 && (
												<Field>
													<FieldLabel htmlFor={`frequent-${person.id}`}>
														从常用询问人选择
													</FieldLabel>
													<Select
														value={null}
														onValueChange={(id) => {
															const selected = frequent.data?.find(
																(p) => p.id === id,
															);
															if (selected)
																update(
																	"inquirers",
																	c.inquirers.map((p) =>
																		p.id === person.id
																			? {
																					...p,
																					name: selected.name,
																					badgeNumber: selected.badgeNumber,
																				}
																			: p,
																	),
																);
														}}
													>
														<SelectTrigger
															id={`frequent-${person.id}`}
															className="w-full"
														>
															<SelectValue placeholder="选择姓名和检查证号" />
														</SelectTrigger>
														<SelectContent>
															<SelectGroup>
																{frequent.data?.map((p) => (
																	<SelectItem key={p.id} value={p.id}>
																		{p.name}（{p.badgeNumber}）
																	</SelectItem>
																))}
															</SelectGroup>
														</SelectContent>
													</Select>
												</Field>
											)}
										</FieldGroup>
									</div>
								))}
							</RadioGroup>
							<Button
								variant="outline"
								disabled={readOnly || c.inquirers.length >= 20}
								disabledReason={
									readOnly ? "当前笔录不可编辑" : "询问人最多添加 20 位"
								}
								onClick={() =>
									update("inquirers", [...c.inquirers, emptyInquirer()])
								}
							>
								<PlusIcon data-icon="inline-start" />
								添加询问人
							</Button>
						</fieldset>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem
					value="subject"
					className="not-last:border-b data-open:bg-transparent"
				>
					<AccordionTrigger className="cursor-pointer items-center gap-2 px-0 py-2.5 font-medium text-foreground text-sm hover:no-underline">
						<span className="truncate">被询问（调查）人</span>
						{subjectSummary && (
							<span className="min-w-0 truncate font-normal text-muted-foreground text-xs">
								{subjectSummary}
							</span>
						)}
					</AccordionTrigger>
					<AccordionContent className="px-0 pt-1 pb-2">
						<fieldset disabled={readOnly} className="min-w-0">
							<FieldGroup>
								<FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,5rem)] gap-3">
									{field("subjectName", "被询问人姓名", "text", 80)}
									<InquirySelect
										id="inquiry-subjectGender"
										label="性别"
										value={c.subjectGender}
										options={["男", "女", "未知"]}
										onChange={(value) => update("subjectGender", value)}
									/>
								</FieldGroup>
								<InquirySelect
									id="inquiry-subjectIdType"
									label="证件种类"
									value={c.subjectIdType}
									options={idTypes}
									onChange={(value) => update("subjectIdType", value)}
								/>
								{field("subjectIdNumber", "证件号码", "text", 80)}
								{field("subjectAddress", "住址", "text", 500)}
								{field("subjectPhone", "联系电话", "tel", 80)}
								{field("subjectOrg", "工作单位")}
								{field("subjectPosition", "职务", "text", 80)}
								<InquirySelect
									id="inquiry-subjectRelationship"
									label="与被检查人关系"
									value={inquiryRelationshipName(c.subjectRelationship)}
									options={relationships}
									onChange={(value) => update("subjectRelationship", value)}
								/>
								{c.subjectRelationship === "其他" &&
									field(
										"subjectRelationshipOther",
										"关系详细说明",
										"text",
										500,
									)}
							</FieldGroup>
						</fieldset>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		);
	},
	(prev, next) => {
		if (
			prev.readOnly !== next.readOnly ||
			prev.onChange !== next.onChange ||
			prev.openSections !== next.openSections ||
			prev.onOpenSectionsChange !== next.onOpenSectionsChange
		) {
			return false;
		}
		if (prev.content === next.content) return true;
		const a = prev.content;
		const b = next.content;
		return (
			a.enforcementUnitName === b.enforcementUnitName &&
			a.inquiryStartAt === b.inquiryStartAt &&
			a.inquiryEndAt === b.inquiryEndAt &&
			a.inquiryCount === b.inquiryCount &&
			a.inquiryLocation === b.inquiryLocation &&
			a.inquirers === b.inquirers &&
			a.subjectName === b.subjectName &&
			a.subjectGender === b.subjectGender &&
			a.subjectAge === b.subjectAge &&
			a.subjectIdType === b.subjectIdType &&
			a.subjectIdNumber === b.subjectIdNumber &&
			a.subjectOrg === b.subjectOrg &&
			a.subjectPosition === b.subjectPosition &&
			a.subjectPhone === b.subjectPhone &&
			a.subjectAddress === b.subjectAddress &&
			a.subjectRelationship === b.subjectRelationship &&
			a.subjectRelationshipOther === b.subjectRelationshipOther
		);
	},
);

export default InquiryBasicFields;
