/**
 * @file 案件笔录的三栏编辑工作区。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：顶部合并笔录操作，三栏支持拖动分隔线调宽；边缘按钮控制侧栏显隐。
 * 被调用：InquiriesView；调用：编辑 Hook、基础/问答表单、A4 页面、Eden。
 * 预期结果：宽屏独立滚动和折叠，窄屏页签切换；离开/导出前保存，失败不误报成功。
 */

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
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@leonwillow-electron/ui/components/resizable";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@leonwillow-electron/ui/components/tabs";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
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
	type InquiryDocument,
	type InquiryRecord,
	inquiryError,
	saveInquiryFile,
} from "@/lib/inquiries";
import InquiryBasicFields from "./basic-fields";
import { InquiryIconButton } from "./controls";
import InquiryDocumentPages from "./document-pages";
import InquiryDocumentPreview from "./document-preview";
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
	const [panelSizes] = useState(() => {
		const styles = getComputedStyle(document.documentElement);
		const size = (name: string) =>
			styles.getPropertyValue(`--inquiry-${name}`).trim();
		return {
			basicDefault: size("basic-default-size"),
			basicMin: size("basic-min-size"),
			basicMax: size("basic-max-size"),
			previewDefault: size("preview-default-size"),
			previewMin: size("preview-min-size"),
			previewMax: size("preview-max-size"),
			questionsMin: size("questions-min-size"),
		};
	});
	const [basicOpen, setBasicOpen] = useState(true);
	const [previewOpen, setPreviewOpen] = useState(true);
	const [exporting, setExporting] = useState(false);
	const operationDisabledReason = editor.conflicted
		? "笔录已在其他位置更新，请重新打开后操作"
		: editor.mutating
			? "正在处理笔录，请稍候"
			: editor.saving
				? "正在保存笔录，请稍候"
				: exporting
					? "正在准备导出，请稍候"
					: "当前笔录不可编辑";

	const exportLock = useRef(false);
	const [printDraft, setPrintDraft] = useState<InquiryDocument | null>(null);
	const printed = useRef(false);
	const root = useRef<HTMLDivElement>(null);
	const { draft } = editor;
	const contentChange = (content: InquiryDocument["content"]) =>
		editor.change({ title: draft.title, content });
	useEffect(() => {
		const media = window.matchMedia("(min-width: 80rem)");
		const update = () => setWide(media.matches);
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	const save = async () => {
		if (editingDisabled) return;
		const result = await editor.persist();
		if (result) {
			toast.success("笔录已保存");
		}
	};
	const saveRef = useRef(save);
	saveRef.current = save;
	useEffect(() => {
		const key = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				if (!editingDisabled) void saveRef.current();
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
			const stored = await editor.persist();
			if (!stored) return;
			if (print) {
				printed.current = false;
				setPrintDraft({
					title: stored.title,
					content: stored.content,
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
	const preview = <InquiryDocumentPreview draft={draft} focus={focus} />;
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
					<span
						role="status"
						className="min-w-0 truncate text-muted-foreground text-xs"
					>
						{editor.mutating
							? "正在处理目录操作…"
							: readOnly
								? "已归档，只读"
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
						disabledReason={
							editingDisabled ? "当前笔录不可编辑" : "没有可以撤销的操作"
						}
						disabled={editingDisabled || !editor.canUndo}
						onClick={editor.undo}
					>
						<Undo2Icon />
					</InquiryIconButton>
					<InquiryIconButton
						label="重做上一步操作"
						disabledReason={
							editingDisabled ? "当前笔录不可编辑" : "没有可以重做的操作"
						}
						disabled={editingDisabled || !editor.canRedo}
						onClick={editor.redo}
					>
						<Redo2Icon />
					</InquiryIconButton>
					{!readOnly && (
						<Button
							variant="outline"
							disabled={
								editingDisabled ||
								editor.saving ||
								exporting ||
								editor.conflicted
							}
							disabledReason={operationDisabledReason}
							onClick={() => void save()}
						>
							<SaveIcon data-icon="inline-start" />
							保存笔录
						</Button>
					)}
					<Button
						variant="outline"
						disabled={
							editor.mutating || editor.saving || exporting || editor.conflicted
						}
						disabledReason={operationDisabledReason}
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
						disabledReason={
							printDraft ? "正在准备打印，请稍候" : operationDisabledReason
						}
						onClick={() => void exportFile(true)}
					>
						<PrinterIcon data-icon="inline-start" />
						打印 / PDF
					</Button>
				</fieldset>
			</InquiryWorkspaceHeader>
			{wide ? (
				<ResizablePanelGroup
					id="inquiry-editor-panels"
					orientation="horizontal"
					className="min-h-0 min-w-0 flex-1"
				>
					<CollapsibleSidePanel
						id="inquiry-basic-panel"
						title="基础信息"
						label="笔录基础信息"
						side="left"
						open={basicOpen}
						onOpenChange={setBasicOpen}
						defaultSize={panelSizes.basicDefault}
						minSize={panelSizes.basicMin}
						maxSize={panelSizes.basicMax}
					>
						{basic}
					</CollapsibleSidePanel>
					<ResizableHandle
						aria-label="调整基础信息宽度"
						disabled={!basicOpen}
						className={cn(!basicOpen && "hidden")}
					/>
					<ResizablePanel
						id="inquiry-questions-panel"
						minSize={panelSizes.questionsMin}
						className="min-h-0 min-w-0"
						style={{ overflow: "hidden" }}
					>
						<ScrollArea
							aria-label="笔录问答编辑"
							className="h-full"
							contentClassName="p-workspace-gutter"
							render={<section />}
						>
							{questions}
						</ScrollArea>
					</ResizablePanel>
					<ResizableHandle
						aria-label="调整文书预览宽度"
						disabled={!previewOpen}
						className={cn(!previewOpen && "hidden")}
					/>
					<CollapsibleSidePanel
						id="inquiry-preview-panel"
						title="文书预览"
						label="笔录文书预览"
						side="right"
						open={previewOpen}
						onOpenChange={setPreviewOpen}
						defaultSize={panelSizes.previewDefault}
						minSize={panelSizes.previewMin}
						maxSize={panelSizes.previewMax}
						className="bg-muted/20"
						scrollable={false}
					>
						{preview}
					</CollapsibleSidePanel>
				</ResizablePanelGroup>
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
					{tab === "preview" ? (
						<section
							aria-label="笔录文书预览"
							className="flex min-h-0 min-w-0 flex-1 flex-col"
						>
							{preview}
						</section>
					) : (
						<ScrollArea
							aria-label={tab === "basic" ? "笔录基础信息" : "笔录问答编辑"}
							className="min-h-0 min-w-0 flex-1"
							contentClassName="p-workspace-gutter"
							render={<section />}
						>
							{tab === "basic" ? basic : questions}
						</ScrollArea>
					)}
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
