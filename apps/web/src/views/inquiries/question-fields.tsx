/**
 * @file 笔录问答的编辑、插入、删除与排序。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：使用 ReUI Sortable 组合排序问答组，单行问答 memo 化并配合稳定回调，隔离长笔录逐字输入重绘。
 * 被调用：RecordEditor；调用：共享 Sortable、表单、Textarea、UUID 工具。
 * 预期结果：稳定 ID 保持输入焦点，单组编辑不触发其余百余组问答重渲染，删除后可由编辑器撤销。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import {
	Sortable,
	SortableItem,
	SortableItemHandle,
} from "@leonwillow-electron/ui/components/sortable";
import { Textarea } from "@leonwillow-electron/ui/components/textarea";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	GripVerticalIcon,
	ListPlusIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import type { InquiryContent } from "@/lib/inquiries";
import { emptyQuestion } from "./record-fields";

type QaItem = InquiryContent["qaItems"][number];

const QuestionRow = memo(function QuestionRow({
	item,
	index,
	total,
	readOnly,
	moveSequence,
	onInsert,
	onMove,
	onRemove,
	onFieldChange,
}: {
	item: QaItem;
	index: number;
	total: number;
	readOnly: boolean;
	moveSequence?: number;
	onInsert: (index: number) => void;
	onMove: (id: string, index: number) => void;
	onRemove: (id: string) => void;
	onFieldChange: (
		id: string,
		field: "question" | "answer",
		value: string,
	) => void;
}) {
	return (
		<SortableItem
			value={item.id}
			disabled={readOnly}
			aria-label={`第 ${index + 1} 组问答`}
			data-question-id={item.id}
			className="relative flex flex-col gap-3 rounded-lg border bg-card p-4"
		>
			{moveSequence !== undefined && (
				<span
					key={moveSequence}
					className="inquiry-question-move-glow"
					aria-hidden="true"
				/>
			)}
			<div className="flex flex-wrap items-center gap-1">
				<SortableItemHandle
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon"
							disabled={readOnly}
							aria-label={`拖动第 ${index + 1} 组问答`}
						/>
					}
				>
					<GripVerticalIcon />
				</SortableItemHandle>
				<span className="mr-auto font-medium text-sm">第 {index + 1} 组</span>
				<TooltipIconButton
					label={`上移第 ${index + 1} 组问答`}
					disabled={readOnly || index === 0}
					disabledReason={
						readOnly ? "当前笔录不可编辑" : "已经是第一组，不能再上移"
					}
					onClick={() => onMove(item.id, index - 1)}
				>
					<ArrowUpIcon />
				</TooltipIconButton>
				<TooltipIconButton
					label={`下移第 ${index + 1} 组问答`}
					disabled={readOnly || index === total - 1}
					disabledReason={
						readOnly ? "当前笔录不可编辑" : "已经是最后一组，不能再下移"
					}
					onClick={() => onMove(item.id, index + 1)}
				>
					<ArrowDownIcon />
				</TooltipIconButton>
				<TooltipIconButton
					label={`在第 ${index + 1} 组上方插入问答`}
					disabled={readOnly || total >= 200}
					disabledReason={readOnly ? "当前笔录不可编辑" : "问答最多添加 200 组"}
					onClick={() => onInsert(index)}
				>
					<PlusIcon />
				</TooltipIconButton>
				<TooltipIconButton
					label={`在第 ${index + 1} 组下方插入问答`}
					disabled={readOnly || total >= 200}
					disabledReason={readOnly ? "当前笔录不可编辑" : "问答最多添加 200 组"}
					onClick={() => onInsert(index + 1)}
				>
					<ListPlusIcon />
				</TooltipIconButton>
				<TooltipIconButton
					label={`删除第 ${index + 1} 组问答`}
					variant="destructive"
					disabled={readOnly || total <= 1}
					disabledReason={
						readOnly ? "当前笔录不可编辑" : "至少保留一组问答，不能继续删除"
					}
					onClick={() => onRemove(item.id)}
				>
					<Trash2Icon />
				</TooltipIconButton>
			</div>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`question-${item.id}`}>问：</FieldLabel>
					<Textarea
						id={`question-${item.id}`}
						rows={2}
						maxLength={10000}
						readOnly={readOnly}
						value={item.question}
						placeholder="请输入询问问题"
						onChange={(e) => onFieldChange(item.id, "question", e.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={`answer-${item.id}`}>答：</FieldLabel>
					<Textarea
						id={`answer-${item.id}`}
						rows={5}
						maxLength={30000}
						readOnly={readOnly}
						value={item.answer}
						placeholder="请输入被询问人回答"
						onChange={(e) => onFieldChange(item.id, "answer", e.target.value)}
					/>
				</Field>
			</FieldGroup>
		</SortableItem>
	);
});

const getItemId = (item: QaItem) => item.id;

const InquiryQuestionFields = memo(function InquiryQuestionFields({
	items,
	onChange,
	readOnly,
}: {
	items: InquiryContent["qaItems"];
	onChange: (value: InquiryContent["qaItems"]) => void;
	readOnly: boolean;
}) {
	const host = useRef<HTMLDivElement>(null);
	const stateRef = useRef({ items, onChange, readOnly });
	stateRef.current = { items, onChange, readOnly };
	const [moveFeedback, setMoveFeedback] = useState<{
		id: string;
		sequence: number;
		position: number;
	} | null>(null);

	const insert = useCallback((index: number) => {
		const current = stateRef.current;
		if (current.items.length >= 200) return;
		const item = emptyQuestion();
		current.onChange([
			...current.items.slice(0, index),
			item,
			...current.items.slice(index),
		]);
		requestAnimationFrame(() =>
			host.current
				?.querySelector<HTMLTextAreaElement>(`#question-${item.id}`)
				?.focus(),
		);
	}, []);

	const move = useCallback((id: string, index: number) => {
		const current = stateRef.current;
		const source = current.items.find((item) => item.id === id);
		if (
			!source ||
			index < 0 ||
			index >= current.items.length ||
			current.readOnly
		) {
			return;
		}
		const next = current.items.filter((item) => item.id !== id);
		next.splice(index, 0, source);
		current.onChange(next);
		setMoveFeedback((previous) => ({
			id,
			sequence: (previous?.sequence ?? 0) + 1,
			position: index + 1,
		}));
		requestAnimationFrame(() =>
			host.current
				?.querySelector(`[data-question-id="${id}"]`)
				?.scrollIntoView({
					block: "nearest",
					inline: "nearest",
					behavior: "instant",
				}),
		);
	}, []);

	const remove = useCallback((id: string) => {
		const current = stateRef.current;
		current.onChange(current.items.filter((r) => r.id !== id));
	}, []);

	const fieldChange = useCallback(
		(id: string, field: "question" | "answer", value: string) => {
			const current = stateRef.current;
			current.onChange(
				current.items.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
			);
		},
		[],
	);

	return (
		<div ref={host} className="flex min-w-0 flex-col gap-workspace-gutter">
			<div className="flex items-center justify-between gap-3">
				<h2 className="font-semibold text-base">询问内容</h2>
				<Button
					variant="outline"
					disabled={readOnly || items.length >= 200}
					disabledReason={readOnly ? "当前笔录不可编辑" : "问答最多添加 200 组"}
					onClick={() => insert(items.length)}
				>
					<PlusIcon data-icon="inline-start" />
					末尾添加
				</Button>
			</div>
			<span className="sr-only" role="status" aria-live="polite">
				{moveFeedback ? `问答已移动到第 ${moveFeedback.position} 组` : ""}
			</span>
			<Sortable
				value={items}
				onValueChange={onChange}
				getItemValue={getItemId}
				strategy="vertical"
				className="flex flex-col gap-workspace-gutter"
			>
				{items.map((item, index) => (
					<QuestionRow
						key={item.id}
						item={item}
						index={index}
						total={items.length}
						readOnly={readOnly}
						moveSequence={
							moveFeedback?.id === item.id ? moveFeedback.sequence : undefined
						}
						onInsert={insert}
						onMove={move}
						onRemove={remove}
						onFieldChange={fieldChange}
					/>
				))}
			</Sortable>
			{!items.length && (
				<Button disabled={readOnly} variant="outline" onClick={() => insert(0)}>
					添加第一组问答
				</Button>
			)}
		</div>
	);
});

export default InquiryQuestionFields;
