/**
 * @file 管理员导入模板、配置字段及年度序号的弹窗。
 * 创建时间：2026-10-10；修改时间：2026-11-05。
 * 版本作用：沿用原 collection-dialog 的共享 Dialog 与表单结构，适配真实 API。
 * 被调用：template-panel；调用：共享 UI、文书客户端。
 * 功能与预期结果：上传只接收 DOCX，已有模板设置带版本校验，取号起点可向前调整。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { Checkbox } from "@leonwillow-electron/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	createDocumentType,
	createSampleType,
	type DocumentField,
	type DocumentType,
	documentError,
	getNextNumber,
	replaceDocumentTemplate,
	setNextNumber,
	updateDocumentType,
} from "@/lib/documents";

const kinds: { value: DocumentField["kind"]; label: string }[] = [
	{ value: "text", label: "单行文字" },
	{ value: "textarea", label: "多行文字" },
	{ value: "date", label: "日期" },
	{ value: "time", label: "时间" },
];
export default function TemplateDialog({
	type,
	sample,
	onClose,
	onSaved,
}: {
	type?: DocumentType;
	sample?: boolean;
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const [name, setName] = useState(type?.name ?? (sample ? "询问通知书" : ""));
	const [prefix, setPrefix] = useState(type?.prefix ?? "滇税三稽查");
	const [year, setYear] = useState(new Date().getFullYear());
	const [next, setNext] = useState(1);
	const [fields, setFields] = useState(type?.fields ?? []);
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		if (!type || year < 2000 || year > 9999) return;
		let live = true;
		void getNextNumber(type.id, year)
			.then((data) => {
				if (live) setNext(data.nextNumber);
			})
			.catch((cause) => {
				if (live) setError(documentError(cause));
			});
		return () => {
			live = false;
		};
	}, [type, year]);
	const run = async (
		action: () => Promise<unknown>,
		message: string,
		close = true,
	) => {
		setBusy(true);
		setError("");
		try {
			await action();
			toast.success(message);
			if (close) onClose();
			await onSaved();
		} catch (cause) {
			setError(documentError(cause));
		} finally {
			setBusy(false);
		}
	};
	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (type)
			void run(
				() => updateDocumentType(type, { name, prefix, fields }),
				"模板设置已保存，历史文书保持原模板。",
			);
		else if (sample)
			void run(
				() => createSampleType({ name, prefix, year, nextNumber: next }),
				"示例模板已导入，可以开始取号。",
			);
		else if (file)
			void run(
				() =>
					createDocumentType({ file, name, prefix, year, nextNumber: next }),
				"模板已导入，请在设置中调整字段。",
			);
	};
	const setField = (key: string, update: Partial<DocumentField>) =>
		setFields((current) =>
			current.map((field) =>
				field.key === key ? { ...field, ...update } : field,
			),
		);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
		>
			<DialogContent
				scrollable
				className="max-h-[calc(100dvh-2rem)] sm:max-w-2xl"
				scrollContentClassName=""
				showCloseButton={!busy}
			>
				<DialogHeader>
					<DialogTitle>
						{type
							? "模板设置"
							: sample
								? "导入询问通知书示例"
								: "导入 Word 模板"}
					</DialogTitle>
					<DialogDescription>
						{type
							? "设置只影响之后取号的文书。历史文书保留原模板和字段。"
							: "文号按文书类型与年份独立递增，首次可接续已有序号。"}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-5">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="template-name">文书类型名称</FieldLabel>
							<Input
								id="template-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={80}
								required
								disabled={busy}
								placeholder="例如：税务事项通知书"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="template-prefix">文号前缀</FieldLabel>
							<Input
								id="template-prefix"
								value={prefix}
								onChange={(event) => setPrefix(event.target.value)}
								maxLength={60}
								required
								disabled={busy}
							/>
							<FieldDescription>
								文号示例：{prefix || "前缀"}〔{year}〕{next}号
							</FieldDescription>
						</Field>
					</FieldGroup>
					<FieldSet>
						<FieldLegend>年度序号</FieldLegend>
						<FieldGroup className="grid grid-cols-2">
							<Field>
								<FieldLabel htmlFor="template-year">年份</FieldLabel>
								<Input
									id="template-year"
									type="number"
									min={2000}
									max={9999}
									value={year}
									onChange={(event) => setYear(Number(event.target.value))}
									required
									disabled={busy}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="template-next">下一序号</FieldLabel>
								<Input
									id="template-next"
									type="number"
									min={1}
									max={2_000_000_000}
									value={next}
									onChange={(event) => setNext(Number(event.target.value))}
									required
									disabled={busy}
								/>
							</Field>
						</FieldGroup>
						<FieldDescription>
							新年份默认从 1 开始。已有年度只能向前调整；删除文书不会回收号码。
						</FieldDescription>
						{type && (
							<Button
								type="button"
								variant="outline"
								disabled={
									busy ||
									year < 2000 ||
									year > 9999 ||
									next < 1 ||
									next > 2_000_000_000
								}
								onClick={() =>
									void run(
										() => setNextNumber(type.id, year, next),
										"年度下一序号已设置。",
										false,
									)
								}
							>
								设置年度下一序号
							</Button>
						)}
					</FieldSet>
					{!sample && (
						<Field>
							<FieldLabel htmlFor="template-file">
								{type ? "替换 Word 模板" : "Word 模板文件"}
							</FieldLabel>
							<Input
								id="template-file"
								type="file"
								accept=".docx"
								required={!type}
								disabled={busy}
								onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							/>
							<FieldDescription>
								最多 5MB。模板必须包含 {"{文书号}"}，其余填写位置使用{" "}
								{"{字段名}"}；请先将 XXXXX 和空白位置替换为字段。
							</FieldDescription>
							{type && file && (
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() =>
										void run(
											() => replaceDocumentTemplate(type, file),
											"新模板已上传，原文书继续使用旧版本。",
										)
									}
								>
									上传并替换模板
								</Button>
							)}
						</Field>
					)}
					{type && (
						<FieldSet>
							<FieldLegend>填写字段 · 模板 v{type.version}</FieldLegend>
							<FieldDescription>
								字段名称来自 Word
								占位符，可调整显示名称、输入类型、默认值。必填只在下载 Word
								时校验，取号与保存不受影响。
							</FieldDescription>
							{fields.map((field) => (
								<FieldSet key={field.key} className="rounded-lg border p-3">
									<FieldLegend variant="label">{`{${field.key}}`}</FieldLegend>
									<FieldGroup className="grid grid-cols-1 sm:grid-cols-2">
										<Field>
											<FieldLabel htmlFor={`label-${field.key}`}>
												显示名称
											</FieldLabel>
											<Input
												id={`label-${field.key}`}
												value={field.label}
												maxLength={80}
												required
												disabled={busy}
												onChange={(event) =>
													setField(field.key, { label: event.target.value })
												}
											/>
										</Field>
										<Field>
											<FieldLabel htmlFor={`kind-${field.key}`}>
												输入类型
											</FieldLabel>
											<Select
												items={kinds}
												value={field.kind}
												disabled={busy}
												onValueChange={(value) => {
													if (value)
														setField(field.key, {
															kind: value as DocumentField["kind"],
														});
												}}
											>
												<SelectTrigger
													id={`kind-${field.key}`}
													className="w-full"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														{kinds.map((kind) => (
															<SelectItem key={kind.value} value={kind.value}>
																{kind.label}
															</SelectItem>
														))}
													</SelectGroup>
												</SelectContent>
											</Select>
										</Field>
										<Field>
											<FieldLabel htmlFor={`default-${field.key}`}>
												默认值
											</FieldLabel>
											<Input
												id={`default-${field.key}`}
												type={
													field.kind === "date" || field.kind === "time"
														? field.kind
														: "text"
												}
												value={field.defaultValue}
												maxLength={4000}
												disabled={busy}
												onChange={(event) =>
													setField(field.key, {
														defaultValue: event.target.value,
													})
												}
											/>
										</Field>
										<Field orientation="horizontal">
											<Checkbox
												id={`required-${field.key}`}
												checked={field.required}
												disabled={busy}
												onCheckedChange={(checked) =>
													setField(field.key, { required: checked === true })
												}
											/>
											<FieldLabel htmlFor={`required-${field.key}`}>
												下载 Word 时必填
											</FieldLabel>
										</Field>
									</FieldGroup>
								</FieldSet>
							))}
						</FieldSet>
					)}
					{error && <FieldError role="alert">{error}</FieldError>}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={onClose}
						>
							取消
						</Button>
						<Button type="submit" disabled={busy}>
							{busy && (
								<LoaderCircleIcon
									className="animate-spin"
									data-icon="inline-start"
								/>
							)}
							{type ? "保存设置" : "导入模板"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
