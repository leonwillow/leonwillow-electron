/**
 * @file 文书弹窗中的精简表单、补充字段和自动 Word 预览。
 * 创建时间：2026-10-10；修改时间：2026-10-11。
 * 版本作用：同一表单完成取号和补填，选填信息可折叠，预览随输入更新。
 * 被调用：documents/records-workspace；调用：字段控件、预览器、Eden 文书客户端。
 * 功能与预期结果：只填对象即可取号；失败保留草稿，历史号码固定，普通人员只修改本人。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@leonwillow-electron/ui/components/collapsible";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	ChevronDownIcon,
	DownloadIcon,
	LoaderCircleIcon,
	SaveIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createDocument,
	type DocumentDetails,
	type DocumentType,
	documentError,
	downloadDocument,
	getNextNumber,
	saveDocumentFile,
	updateDocument,
} from "@/lib/documents";
import DocumentPreview from "./document-preview";
import FieldInput from "./field-input";
import useDocumentPreview from "./use-document-preview";

export default function DocumentEditor({
	type,
	details,
	userId,
	admin,
	onSaved,
	onClose,
	onBusyChange,
}: {
	type?: DocumentType;
	details?: DocumentDetails;
	userId: string;
	admin: boolean;
	onSaved: (id: string) => Promise<void>;
	onClose: () => void;
	onBusyChange: (busy: boolean) => void;
}) {
	const typeId = details?.record.typeId ?? type?.id ?? "";
	const fields = details?.fields ?? type?.fields ?? [];
	const recipient = fields.find((field) =>
		["受询问人", "被询问人", "纳税人", "当事人", "单位名称", "对象"].includes(
			field.key,
		),
	);
	const extraFields = fields.filter((field) => field.key !== recipient?.key);
	const [expanded, setExpanded] = useState(false);
	const [year, setYear] = useState(
		details?.record.year ?? new Date().getFullYear(),
	);
	const [subject, setSubject] = useState(details?.record.subject ?? "");
	const [values, setValues] = useState<Record<string, string>>(
		details?.record.values ??
			Object.fromEntries(
				fields.map((field) => [field.key, field.defaultValue]),
			),
	);
	const [busy, setBusy] = useState<"save" | "download" | null>(null);
	const [error, setError] = useState("");
	const [next, setNext] = useState<number | null>(null);
	const [changed, setChanged] = useState(false);
	const requestId = useRef(crypto.randomUUID());
	const canEdit = !details || admin || details.record.ownerId === userId;
	useEffect(() => {
		onBusyChange(!!busy);
		return () => onBusyChange(false);
	}, [busy, onBusyChange]);
	useEffect(() => {
		if (details) setChanged(false);
	}, [details]);
	useEffect(() => {
		if (details) return;
		setNext(null);
		if (!typeId || !Number.isInteger(year) || year < 2000 || year > 9999)
			return;
		let live = true;
		void getNextNumber(typeId, year)
			.then((data) => {
				if (live) setNext(data.nextNumber);
			})
			.catch((cause) => {
				if (live) setError(documentError(cause));
			});
		return () => {
			live = false;
		};
	}, [details, typeId, year]);
	const resolvedSubject =
		subject.trim() ||
		(recipient ? values[recipient.key]?.trim().slice(0, 160) : "") ||
		"文书草稿";
	const draft = { typeId, year, subject: resolvedSubject, values };
	const preview = useDocumentPreview(draft, details, changed);
	const missingFields = fields.filter(
		(field) =>
			field.required && !(values[field.key] ?? field.defaultValue).trim(),
	);
	const markChanged = () => {
		setChanged(true);
		setError("");
	};
	const setField = (key: string, value: string) => {
		if (key === recipient?.key && subject === (values[key] ?? ""))
			setSubject(value.slice(0, 160));
		setValues((current) => ({ ...current, [key]: value }));
		markChanged();
	};
	/** 最少对象信息即可保存；完整性只控制 Word 下载，失败保留输入和幂等请求标识。 */
	const save = async (event: React.FormEvent) => {
		event.preventDefault();
		if (busy || !canEdit) return;
		if (!(recipient ? values[recipient.key]?.trim() : subject.trim())) {
			setError(`请填写${recipient?.label ?? "文书事项"}。`);
			return;
		}
		setBusy("save");
		setError("");
		try {
			if (details) {
				await updateDocument(details.record.id, {
					subject: resolvedSubject,
					values,
					revision: details.record.revision,
				});
				toast.success("文书已保存，文号保持不变。");
				await onSaved(details.record.id);
			} else {
				const result = await createDocument(draft, requestId.current);
				toast.success(`已取号：${result.documentNumber}`);
				await onSaved(result.id);
			}
		} catch (cause) {
			setError(documentError(cause));
		} finally {
			setBusy(null);
		}
	};
	const download = async () => {
		if (!details || busy) return;
		setBusy("download");
		setError("");
		try {
			saveDocumentFile(
				await downloadDocument(details.record.id),
				`${details.record.documentNumber}.docx`,
			);
		} catch (cause) {
			setError(documentError(cause));
		} finally {
			setBusy(null);
		}
	};
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
			<form
				onSubmit={(event) => void save(event)}
				className="flex min-h-0 shrink-0 flex-col border-b lg:w-96 lg:border-r lg:border-b-0"
			>
				<div className="flex min-h-0 flex-1 flex-col gap-4 p-workspace-gutter lg:overflow-y-auto">
					{details && (
						<div className="flex flex-col gap-1">
							<CopyText
								value={details.record.documentNumber}
								className="break-all font-medium"
							/>
							<p className="text-muted-foreground text-xs">
								{details.record.ownerName} · 模板 v
								{details.record.templateVersion}
							</p>
						</div>
					)}
					{!canEdit && (
						<p className="text-muted-foreground text-xs">
							这是其他人员的文书，你可以查看和下载。
						</p>
					)}
					<FieldGroup>
						{!details && (
							<Field>
								<FieldLabel htmlFor="document-year">文号年份</FieldLabel>
								<Input
									id="document-year"
									type="number"
									min={2000}
									max={9999}
									value={year}
									required
									disabled={!!busy}
									onChange={(event) => {
										setYear(Number(event.target.value));
										markChanged();
									}}
								/>
								<p className="text-muted-foreground text-xs">
									{next === null
										? "请输入有效年份以读取下一序号。"
										: `下一文号参考：${type?.prefix}〔${year}〕${next}号`}
									<br />
									最终号码以保存时分配为准。
								</p>
							</Field>
						)}
						{recipient ? (
							<FieldInput
								field={recipient}
								required
								value={values[recipient.key] ?? ""}
								disabled={!canEdit || !!busy}
								onChange={(value) => setField(recipient.key, value)}
							/>
						) : (
							<Field>
								<FieldLabel htmlFor="document-subject">文书事项 *</FieldLabel>
								<Input
									id="document-subject"
									value={subject}
									maxLength={160}
									required
									disabled={!canEdit || !!busy}
									placeholder="填写事项或对象即可取号"
									onChange={(event) => {
										setSubject(event.target.value);
										markChanged();
									}}
								/>
							</Field>
						)}
					</FieldGroup>
					{(extraFields.length > 0 || recipient) && (
						<Collapsible open={expanded} onOpenChange={setExpanded}>
							<CollapsibleTrigger
								render={
									<Button
										variant="outline"
										type="button"
										className="w-full justify-between"
									/>
								}
							>
								<span>补充文书内容（选填）</span>
								<ChevronDownIcon
									className={expanded ? "rotate-180" : ""}
									data-icon="inline-end"
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="pt-4">
								<FieldGroup>
									{recipient && (
										<Field>
											<FieldLabel htmlFor="document-subject">
												文书事项
											</FieldLabel>
											<Input
												id="document-subject"
												value={subject}
												maxLength={160}
												disabled={!canEdit || !!busy}
												placeholder="选填，用于检索"
												onChange={(event) => {
													setSubject(event.target.value);
													markChanged();
												}}
											/>
										</Field>
									)}
									{extraFields.map((field) => (
										<FieldInput
											key={field.key}
											field={field}
											required={false}
											value={values[field.key] ?? ""}
											disabled={!canEdit || !!busy}
											onChange={(value) => setField(field.key, value)}
										/>
									))}
								</FieldGroup>
							</CollapsibleContent>
						</Collapsible>
					)}
					{details && (
						<Collapsible>
							<CollapsibleTrigger
								render={
									<Button
										variant="ghost"
										type="button"
										className="w-full justify-between"
									/>
								}
							>
								<span>修改记录 · v{details.record.revision}</span>
								<ChevronDownIcon data-icon="inline-end" />
							</CollapsibleTrigger>
							<CollapsibleContent className="pt-2">
								<div className="flex flex-col gap-2 text-muted-foreground text-xs">
									{details.history.map((item) => (
										<p key={item.revision}>
											v{item.revision} · {item.actorName} ·{" "}
											{item.action === "create" ? "取号" : "修改"} ·{" "}
											{new Date(item.createdAt).toLocaleString("zh-CN", {
												hour12: false,
											})}
										</p>
									))}
								</div>
							</CollapsibleContent>
						</Collapsible>
					)}
					{error && <FieldError role="alert">{error}</FieldError>}
				</div>
				<div className="flex shrink-0 flex-col gap-3 border-t p-workspace-gutter">
					<p className="text-muted-foreground text-xs">
						{missingFields.length > 0
							? `${details ? "可保存未填完的信息" : "可先取号、稍后补填"}。下载 Word 前还需补充 ${missingFields.length} 项内容。`
							: changed && details
								? "保存修改后可下载 Word。"
								: details
									? "点击文号可复制，已保存的文书可下载 Word。"
									: "填写对象即可取号，补充内容可稍后填写。"}
					</p>
					<div className="flex flex-wrap gap-2">
						{canEdit && (
							<Button type="submit" disabled={!!busy || !typeId}>
								{busy === "save" ? (
									<LoaderCircleIcon
										className="animate-spin"
										data-icon="inline-start"
									/>
								) : (
									<SaveIcon data-icon="inline-start" />
								)}
								{details ? "保存修改" : "立即取号"}
							</Button>
						)}
						{details && (
							<Button
								type="button"
								variant="outline"
								disabled={!!busy || changed || missingFields.length > 0}
								onClick={() => void download()}
							>
								<DownloadIcon data-icon="inline-start" />
								下载 Word
							</Button>
						)}
						<Button
							type="button"
							variant="ghost"
							disabled={!!busy}
							onClick={onClose}
						>
							关闭
						</Button>
					</div>
				</div>
			</form>
			<section
				aria-label="文书预览区"
				aria-busy={preview.loading}
				className="flex min-h-96 min-w-0 flex-1 flex-col gap-3 p-workspace-gutter lg:min-h-0"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="font-medium text-sm">实时预览</h2>
					<p role="status" className="text-muted-foreground text-xs">
						{preview.loading
							? "正在更新预览…"
							: preview.error
								? "预览未更新"
								: details
									? "已同步当前内容"
									: "草稿预览 · 不占用文号"}
					</p>
				</div>
				{preview.error && (
					<div className="flex flex-wrap items-center gap-2">
						<p role="alert" className="text-destructive text-xs">
							{preview.error}
						</p>
						<Button size="sm" variant="outline" onClick={preview.retry}>
							重新预览
						</Button>
					</div>
				)}
				<DocumentPreview blob={preview.blob} />
			</section>
		</div>
	);
}
