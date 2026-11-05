/**
 * @file 笔录问答的编辑、插入、删除与排序。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：使用 ReUI c-sortable-3 的组合排序问答组，接入原有编辑历史与保存。
 * 被调用：RecordEditor；调用：共享 Sortable、表单、Textarea、UUID 工具。
 * 预期结果：稳定 ID 保持输入焦点，正文换行保留，删除后可由编辑器撤销。
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
import {
	ArrowDownIcon,
	ArrowUpIcon,
	GripVerticalIcon,
	ListPlusIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useRef } from "react";
import type { InquiryContent } from "@/lib/inquiries";
import { InquiryIconButton } from "./controls";
import { emptyQuestion } from "./record-fields";

export default function InquiryQuestionFields({
	items,
	onChange,
	readOnly,
}: {
	items: InquiryContent["qaItems"];
	onChange: (value: InquiryContent["qaItems"]) => void;
	readOnly: boolean;
}) {
	const host = useRef<HTMLDivElement>(null);
	const insert = (index: number) => {
		if (items.length >= 200) return;
		const item = emptyQuestion();
		onChange([...items.slice(0, index), item, ...items.slice(index)]);
		requestAnimationFrame(() =>
			host.current
				?.querySelector<HTMLTextAreaElement>(`#question-${item.id}`)
				?.focus(),
		);
	};
	const move = (id: string, index: number) => {
		const source = items.find((item) => item.id === id);
		if (!source || index < 0 || index >= items.length || readOnly) return;
		const next = items.filter((item) => item.id !== id);
		next.splice(index, 0, source);
		onChange(next);
	};
	return (
		<div ref={host} className="flex min-w-0 flex-col gap-4">
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
			<Sortable
				value={items}
				onValueChange={onChange}
				getItemValue={(item) => item.id}
				strategy="vertical"
				className="flex flex-col gap-4"
			>
				{items.map((item, index) => (
					<SortableItem
						key={item.id}
						value={item.id}
						disabled={readOnly}
						aria-label={`第 ${index + 1} 组问答`}
						className="flex flex-col gap-3 rounded-lg border bg-card p-4"
					>
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
							<span className="mr-auto font-medium text-sm">
								第 {index + 1} 组
							</span>
							<InquiryIconButton
								label={`上移第 ${index + 1} 组问答`}
								disabled={readOnly || index === 0}
								disabledReason={
									readOnly ? "当前笔录不可编辑" : "已经是第一组，不能再上移"
								}
								onClick={() => move(item.id, index - 1)}
							>
								<ArrowUpIcon />
							</InquiryIconButton>
							<InquiryIconButton
								label={`下移第 ${index + 1} 组问答`}
								disabled={readOnly || index === items.length - 1}
								disabledReason={
									readOnly ? "当前笔录不可编辑" : "已经是最后一组，不能再下移"
								}
								onClick={() => move(item.id, index + 1)}
							>
								<ArrowDownIcon />
							</InquiryIconButton>
							<InquiryIconButton
								label={`在第 ${index + 1} 组上方插入问答`}
								disabled={readOnly || items.length >= 200}
								disabledReason={
									readOnly ? "当前笔录不可编辑" : "问答最多添加 200 组"
								}
								onClick={() => insert(index)}
							>
								<PlusIcon />
							</InquiryIconButton>
							<InquiryIconButton
								label={`在第 ${index + 1} 组下方插入问答`}
								disabled={readOnly || items.length >= 200}
								disabledReason={
									readOnly ? "当前笔录不可编辑" : "问答最多添加 200 组"
								}
								onClick={() => insert(index + 1)}
							>
								<ListPlusIcon />
							</InquiryIconButton>
							<InquiryIconButton
								label={`删除第 ${index + 1} 组问答`}
								variant="destructive"
								disabled={readOnly || items.length <= 1}
								disabledReason={
									readOnly
										? "当前笔录不可编辑"
										: "至少保留一组问答，不能继续删除"
								}
								onClick={() => onChange(items.filter((r) => r.id !== item.id))}
							>
								<Trash2Icon />
							</InquiryIconButton>
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
									onChange={(e) =>
										onChange(
											items.map((r) =>
												r.id === item.id
													? { ...r, question: e.target.value }
													: r,
											),
										)
									}
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
									onChange={(e) =>
										onChange(
											items.map((r) =>
												r.id === item.id ? { ...r, answer: e.target.value } : r,
											),
										)
									}
								/>
							</Field>
						</FieldGroup>
					</SortableItem>
				))}
			</Sortable>
			{!items.length && (
				<Button disabled={readOnly} variant="outline" onClick={() => insert(0)}>
					添加第一组问答
				</Button>
			)}
		</div>
	);
}
