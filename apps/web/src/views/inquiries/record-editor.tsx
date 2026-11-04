/**
 * @file 案件笔录的三栏编辑工作区。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：顶部合并笔录操作，三栏承载信息、问答和文书；边缘手柄控制侧栏显隐。
 * 被调用：InquiriesView；调用：编辑 Hook、基础/问答表单、A4 页面、Eden。
 * 预期结果：宽屏独立滚动和折叠，窄屏页签切换；离开/导出前保存，失败不误报成功。
 */
import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import { CollapsibleSidePanel } from "@leonwillow-electron/ui/components/collapsible-side-panel";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { Field, FieldLabel } from "@leonwillow-electron/ui/components/field";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import {
	CheckIcon,
	DownloadIcon,
	EyeIcon,
	PrinterIcon,
	Redo2Icon,
	SaveIcon,
	Undo2Icon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
	exportInquiryRecord,
	type InquiryDraft,
	type InquiryRecord,
	inquiryError,
	saveInquiryFile,
} from "@/lib/inquiries";
import InquiryBasicFields from "./basic-fields";
import { InquiryIconButton } from "./controls";
import InquiryDocumentPages from "./document-pages";
import InquiryQuestionFields from "./question-fields";
import { useInquiryEditor } from "./use-inquiry-editor";
import InquiryWorkspaceHeader from "./workspace-header";

export default function InquiryRecordEditor({
	record,
	readOnly,
}: {
	record: InquiryRecord;
	readOnly: boolean;
}) {
	const editor = useInquiryEditor(record, readOnly);
	const editingDisabled = readOnly || editor.mutating;
	const [wide, setWide] = useState(
		() => window.matchMedia("(min-width: 80rem)").matches,
	);
	const [tab, setTab] = useState("basic");
	const [basicOpen, setBasicOpen] = useState(true);
	const [previewOpen, setPreviewOpen] = useState(true);
	const [exporting, setExporting] = useState(false);
	const exportLock = useRef(false);
	const [printDraft, setPrintDraft] = useState<InquiryDraft | null>(null);
	const printed = useRef(false);
	const root = useRef<HTMLDivElement>(null);
	const { draft } = editor;
	const contentChange = (content: InquiryDraft["content"]) =>
		editor.change({ title: draft.title, content });
	useEffect(() => {
		const media = window.matchMedia("(min-width: 80rem)");
		const update = () => setWide(media.matches);
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	const save = async (status: "draft" | "final") => {
		if (editingDisabled) return;
		const result = await editor.persist(status);
		if (result) {
			toast.success(status === "final" ? "笔录已完成" : "草稿已保存");
		}
	};
	const saveRef = useRef(save);
	saveRef.current = save;
	useEffect(() => {
		const key = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				if (!editingDisabled) void saveRef.current("draft");
			}
		};
		document.addEventListener("keydown", key);
		return () => document.removeEventListener("keydown", key);
	}, [editingDisabled]);
	const exportFile = async (print: boolean) => {
		if (exportLock.current || editor.mutating) return;
		exportLock.current = true;
		setExporting(true);
		try {
			const stored = await editor.persist(
				editor.dirty ? "draft" : draft.status,
			);
			if (!stored) return;
			if (print) {
				printed.current = false;
				setPrintDraft({
					title: stored.title,
					content: stored.content,
					status: stored.status,
				});
			} else {
				saveInquiryFile(
					await exportInquiryRecord(record.caseId, record.id),
					stored.title,
				);
				toast.success("可编辑 Word 已导出");
			}
		} catch (cause) {
			toast.error(inquiryError(cause));
		} finally {
			exportLock.current = false;
			setExporting(false);
		}
	};
	const printReady = useCallback(() => {
		if (printed.current) return;
		printed.current = true;
		window.print();
		setPrintDraft(null);
	}, []);
	const printError = useCallback((message: string) => {
		setPrintDraft(null);
		toast.error(message);
	}, []);
	const focus = (id: string) => {
		const isQuestion = id.startsWith("question-") || id.startsWith("answer-");
		setTab(isQuestion ? "questions" : "basic");
		if (!isQuestion) setBasicOpen(true);
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				const element = root.current?.querySelector<HTMLElement>(
					`#${CSS.escape(id)}`,
				);
				element?.scrollIntoView({ block: "center", behavior: "smooth" });
				element?.focus({ preventScroll: true });
			}),
		);
	};
	const basic = (
		<InquiryBasicFields
			content={draft.content}
			onChange={contentChange}
			readOnly={editingDisabled}
		/>
	);
	const questions = (
		<InquiryQuestionFields
			items={draft.content.qaItems}
			onChange={(qaItems) => contentChange({ ...draft.content, qaItems })}
			readOnly={editingDisabled}
		/>
	);
	const preview = <InquiryDocumentPages draft={draft} focus={focus} />;
	return (
		<div ref={root} className="flex min-h-0 min-w-0 flex-1 flex-col">
			<InquiryWorkspaceHeader>
				<div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
					<Field className="min-w-32 max-w-64 flex-1">
						<FieldLabel className="sr-only" htmlFor="inquiry-title">
							笔录名称
						</FieldLabel>
						<Input
							id="inquiry-title"
							aria-label="笔录名称"
							value={draft.title}
							maxLength={80}
							readOnly={editingDisabled}
							onChange={(e) =>
								editor.change({ title: e.target.value, content: draft.content })
							}
						/>
					</Field>
					<Badge variant={draft.status === "final" ? "success" : "secondary"}>
						{draft.status === "final" ? "已完成" : "草稿"}
					</Badge>
					<span
						role="status"
						className="min-w-0 truncate text-muted-foreground text-xs"
					>
						{editor.mutating
							? "正在处理目录操作…"
							: readOnly
								? "案件已归档，只读"
								: editor.saving
									? "正在保存…"
									: editor.error
										? "保存失败，内容仍保留"
										: editor.dirty
											? "有修改 · 每 5 秒自动保存"
											: `已保存 ${new Date(editor.savedAt).toLocaleTimeString("zh-CN", { hour12: false })}`}
					</span>
				</div>
				<fieldset
					aria-label="笔录操作"
					className="ml-auto flex min-w-0 flex-wrap items-center gap-2"
				>
					<InquiryIconButton
						label="撤销上一步操作"
						disabled={editingDisabled || !editor.canUndo}
						onClick={editor.undo}
					>
						<Undo2Icon />
					</InquiryIconButton>
					<InquiryIconButton
						label="重做上一步操作"
						disabled={editingDisabled || !editor.canRedo}
						onClick={editor.redo}
					>
						<Redo2Icon />
					</InquiryIconButton>
					{!readOnly && (
						<>
							<Button
								variant="outline"
								disabled={
									editingDisabled ||
									editor.saving ||
									exporting ||
									editor.conflicted
								}
								onClick={() => void save("draft")}
							>
								<SaveIcon data-icon="inline-start" />
								保存草稿
							</Button>
							<Button
								disabled={
									editingDisabled ||
									editor.saving ||
									exporting ||
									editor.conflicted
								}
								onClick={() => void save("final")}
							>
								<CheckIcon data-icon="inline-start" />
								完成笔录
							</Button>
						</>
					)}
					<Button
						variant="outline"
						disabled={
							editor.mutating || editor.saving || exporting || editor.conflicted
						}
						onClick={() => void exportFile(false)}
					>
						<DownloadIcon data-icon="inline-start" />
						Word
					</Button>
					<Button
						variant="outline"
						disabled={
							editor.mutating ||
							editor.saving ||
							exporting ||
							!!printDraft ||
							editor.conflicted
						}
						onClick={() => void exportFile(true)}
					>
						<PrinterIcon data-icon="inline-start" />
						打印 / PDF
					</Button>
				</fieldset>
			</InquiryWorkspaceHeader>
			{editor.error && (
				<div className="flex flex-wrap items-center gap-2 border-b p-workspace-gutter">
					<p role="alert" className="text-destructive text-sm">
						{editor.error}
					</p>
					{!editor.conflicted && (
						<Button
							variant="outline"
							disabled={editingDisabled || editor.saving}
							onClick={() => void save("draft")}
						>
							重试保存
						</Button>
					)}
					{editor.conflicted && (
						<p className="text-muted-foreground text-sm">
							请先复制需要保留的内容，再重新打开这份笔录。
						</p>
					)}
				</div>
			)}
			{wide ? (
				<div className="flex min-h-0 min-w-0 flex-1">
					<CollapsibleSidePanel
						title="基础信息"
						label="笔录基础信息"
						side="left"
						open={basicOpen}
						onOpenChange={setBasicOpen}
						className="w-72 border-r"
					>
						{basic}
					</CollapsibleSidePanel>
					<section
						aria-label="笔录问答编辑"
						className="min-h-0 min-w-0 flex-1 overflow-auto p-workspace-gutter"
					>
						{questions}
					</section>
					<CollapsibleSidePanel
						title="文书预览"
						label="笔录文书预览"
						side="right"
						open={previewOpen}
						onOpenChange={setPreviewOpen}
						className="w-96 border-l bg-muted/20"
					>
						{preview}
					</CollapsibleSidePanel>
				</div>
			) : (
				<>
					<Tabs
						value={tab}
						onValueChange={(value) => setTab(String(value))}
						className="shrink-0 border-b px-workspace-gutter py-2"
					>
						<TabsList aria-label="笔录编辑分区">
							<TabsTrigger value="basic">基础信息</TabsTrigger>
							<TabsTrigger value="questions">问答记录</TabsTrigger>
							<TabsTrigger value="preview">
								<EyeIcon />
								文书预览
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<section
						aria-label={
							tab === "basic"
								? "笔录基础信息"
								: tab === "questions"
									? "笔录问答编辑"
									: "笔录文书预览"
						}
						className="min-h-0 min-w-0 flex-1 overflow-auto p-workspace-gutter"
					>
						{tab === "basic"
							? basic
							: tab === "questions"
								? questions
								: preview}
					</section>
				</>
			)}
			<Dialog
				open={editor.blocker.status === "blocked"}
				onOpenChange={(open) => {
					if (!open) editor.blocker.reset?.();
				}}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>笔录尚未保存</DialogTitle>
						<DialogDescription>
							保存未成功，当前修改仍留在编辑器。可以继续编辑，或放弃本次未保存的修改后离开。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => editor.blocker.reset?.()}>
							继续编辑
						</Button>
						<Button
							variant="destructive"
							onClick={() => editor.blocker.proceed?.()}
						>
							放弃修改并离开
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{printDraft &&
				createPortal(
					<div className="inquiry-print-root">
						<InquiryDocumentPages
							draft={printDraft}
							preview={false}
							onReady={printReady}
							onError={printError}
						/>
					</div>,
					document.body,
				)}
		</div>
	);
}
