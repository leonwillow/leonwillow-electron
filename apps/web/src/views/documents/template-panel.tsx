/**
 * @file 管理员模板目录和删除确认。
 * 创建时间：2026-10-10；修改时间：2026-11-05。
 * 版本作用：复用原知识库目录的卡片和弹窗操作，使用服务端模板列表。
 * 被调用：documents/index；调用：共享 UI、template-dialog、文书客户端。
 * 功能与预期结果：可导入/设置/下载/删除模板，删除保留原版本与历史文书。
 */

import { Badge } from "@leonwillow-electron/ui/components/badge";
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leonwillow-electron/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import {
	DownloadIcon,
	FilePlus2Icon,
	Settings2Icon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	type DocumentType,
	deleteDocumentType,
	documentError,
	downloadSampleTemplate,
	downloadTypeTemplate,
	saveDocumentFile,
} from "@/lib/documents";
import TemplateDialog from "./template-dialog";
export default function TemplatePanel({
	types,
	onSaved,
}: {
	types: DocumentType[];
	onSaved: () => Promise<void>;
}) {
	const [dialog, setDialog] = useState<{
		type?: DocumentType;
		sample?: boolean;
	} | null>(null);
	const [remove, setRemove] = useState<DocumentType | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const download = async (type?: DocumentType) => {
		try {
			saveDocumentFile(
				type
					? await downloadTypeTemplate(type.id)
					: await downloadSampleTemplate(),
				type?.fileName ?? "询问通知书模板.docx",
			);
		} catch (cause) {
			setError(documentError(cause));
		}
	};
	const confirmRemove = async () => {
		if (!remove) return;
		setBusy(true);
		setError("");
		try {
			await deleteDocumentType(remove);
			setRemove(null);
			toast.success("模板已删除，历史文书仍可查看和下载。");
			await onSaved();
		} catch (cause) {
			setError(documentError(cause));
		} finally {
			setBusy(false);
		}
	};
	return (
		<ScrollArea
			className="min-h-0 flex-1"
			contentClassName="flex flex-col gap-5 p-workspace-gutter"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-medium text-base">文书模板</h2>
					<p className="mt-1 text-muted-foreground text-xs">
						Word 中使用 {"{文书号}"}、{"{字段名}"}；导入后自动生成填写表单。
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => void download()}>
						<DownloadIcon data-icon="inline-start" />
						下载示例
					</Button>
					<Button variant="outline" onClick={() => setDialog({ sample: true })}>
						<FilePlus2Icon data-icon="inline-start" />
						导入询问通知书示例
					</Button>
					<Button onClick={() => setDialog({})}>
						<UploadIcon data-icon="inline-start" />
						导入模板
					</Button>
				</div>
			</div>
			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}
			{!types.length && (
				<p className="p-6 text-muted-foreground text-sm">
					尚未导入模板。可先导入你提供的询问通知书示例，再设置机关名称、联系人等默认值。
				</p>
			)}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
				{types.map((type) => (
					<Card key={type.id}>
						<CardHeader>
							<CardTitle className="text-base">{type.name}</CardTitle>
							<CardDescription>
								文号格式：{type.prefix}〔年份〕序号 + 号
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<div className="flex flex-wrap gap-2">
								<Badge variant="secondary">模板 v{type.version}</Badge>
								<Badge variant="outline">{type.fields.length} 个填写字段</Badge>
							</div>
							<p className="truncate text-muted-foreground text-xs">
								{type.fileName}
							</p>
							<p className="text-muted-foreground text-xs">
								{type.fields.map((field) => field.label).join("、") ||
									"仅自动填入文书号"}
							</p>
						</CardContent>
						<CardFooter className="flex flex-wrap gap-2">
							<Button variant="outline" onClick={() => setDialog({ type })}>
								<Settings2Icon data-icon="inline-start" />
								设置
							</Button>
							<Button variant="outline" onClick={() => void download(type)}>
								<DownloadIcon data-icon="inline-start" />
								下载模板
							</Button>
							<Button variant="destructive" onClick={() => setRemove(type)}>
								<Trash2Icon data-icon="inline-start" />
								删除
							</Button>
						</CardFooter>
					</Card>
				))}
			</div>
			{dialog && (
				<TemplateDialog
					type={dialog.type}
					sample={dialog.sample}
					onClose={() => setDialog(null)}
					onSaved={onSaved}
				/>
			)}
			<Dialog
				open={!!remove}
				onOpenChange={(open) => {
					if (!open && !busy) setRemove(null);
				}}
			>
				<DialogContent showCloseButton={!busy}>
					<DialogHeader>
						<DialogTitle>删除文书模板</DialogTitle>
						<DialogDescription>
							删除“{remove?.name}
							”后不能再用它取号。历史文书与已用号码保留，已有文书仍可查看、修改和下载。
						</DialogDescription>
					</DialogHeader>
					{error && (
						<p role="alert" className="text-destructive text-xs">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setRemove(null)}
						>
							取消
						</Button>
						<Button
							variant="destructive"
							disabled={busy}
							onClick={() => void confirmRemove()}
						>
							确认删除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</ScrollArea>
	);
}
