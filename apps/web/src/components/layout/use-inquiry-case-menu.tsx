/**
 * @file 笔录案件文件夹菜单的内容、操作及弹窗。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：为统一菜单框提供独立笔录、可折叠案件目录及常用询问人入口。
 * 被调用：WorkspaceSecondaryMenu；调用：笔录资源上下文、Eden、共享控件。
 * 预期结果：点击文件夹展开/折叠，点击叶子笔录打开编辑；行操作不再另占一行。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { TooltipIconButton } from "@leonwillow-electron/ui/components/tooltip-icon-button";
import { Tree } from "@leonwillow-electron/ui/components/tree";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
	ArchiveIcon,
	FilePlus2Icon,
	FolderPlusIcon,
	UsersIcon,
} from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateInquiry } from "@/hooks/use-create-inquiry";
import {
	type InquiryCase,
	type InquiryRow,
	inquiryError,
	updateInquiryCase,
	updateInquiryRecordMetadata,
} from "@/lib/inquiries";
import { AsyncStatusBlock } from "./async-state";
import { useInquiryEditorActions } from "./inquiry-editor-actions";
import { useInquiryNavigation } from "./inquiry-navigation-provider";
import InquiryTreeItem from "./inquiry-tree-item";
import { useInquiryTree } from "./use-inquiry-tree";
import type { WorkspaceMenuContent } from "./workspace-menu";
import { WorkspaceMenuSearch } from "./workspace-menu-search";

const InquiryCaseDialog = lazy(() => import("./inquiry-case-dialog"));
const InquiryRecordNameDialog = lazy(
	() => import("./inquiry-record-name-dialog"),
);
const EMPTY_INQUIRY_CASES: InquiryCase[] = [];

export function useInquiryCaseMenu(): WorkspaceMenuContent {
	const menu = useInquiryNavigation();
	const creation = useCreateInquiry();
	const router = useRouter();
	const navigate = useNavigate();
	const {
		query: search,
		setQuery: setSearch,

		archived,
		setArchived,
	} = menu;
	const editorActions = useInquiryEditorActions();
	const [editing, setEditing] = useState<InquiryCase | "new" | null>(null);
	const [editingRecord, setEditingRecord] = useState<{
		row: InquiryCase;
		record: Pick<InquiryRow, "id" | "title" | "revision" | "archived">;
	} | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const lock = useRef(false);
	const rows = menu.cases.data ?? EMPTY_INQUIRY_CASES;
	const { tree } = useInquiryTree(rows, {
		active: menu.visible,
		onOpenRecord: (caseId, recordId) => {
			if (lock.current) return;
			void navigate({
				to: "/inquiries",
				search: { inquiryCaseId: caseId, recordId },
			});
			menu.dismiss();
		},
		query: search.trim(),
	});

	/** 当前编辑笔录先完成保存；失败时中止归档，归档后先释放编辑锁再离开编辑器避免误触发离开拦截。 */
	const mutate = async (row: InquiryCase) => {
		if (lock.current || creation.busy) return;
		lock.current = true;
		setBusy(true);
		setError("");
		try {
			const prepared = await editorActions.prepareMutation(row.id);
			if (prepared === null) {
				setError("当前笔录未能保存，请先处理编辑器中的错误后重试。");
				return;
			}
			await updateInquiryCase(row, { archived: !row.archived });
			editorActions.finishMutation();
			const currentSearch = router.state.location.search;
			if (row.id === currentSearch.inquiryCaseId)
				await navigate({ to: "/inquiries", search: {} });
			await menu.cases.reload();
		} catch (cause) {
			setError(inquiryError(cause));
		} finally {
			editorActions.finishMutation();
			lock.current = false;
			setBusy(false);
		}
	};
	/** 先保存正在编辑的目标，再按最新修订修改元数据；失败保留对话框和正文。 */
	const mutateRecord = async (
		row: InquiryCase,
		record: Pick<InquiryRow, "id" | "title" | "revision" | "archived">,
		patch: { title: string } | { archived: boolean },
	) => {
		if (lock.current || creation.busy) return;
		lock.current = true;
		setBusy(true);
		try {
			const prepared = await editorActions.prepareMutation(row.id, record.id);
			if (prepared === null) {
				toast.error("当前笔录未能保存，请先处理保存错误后重试。");
				return;
			}
			const updated = await updateInquiryRecordMetadata(
				row.id,
				record.id,
				prepared?.revision ?? record.revision,
				patch,
			);
			editorActions.acceptMutation(updated);
			editorActions.finishMutation();
			if (
				"archived" in patch &&
				router.state.location.search.recordId === record.id
			)
				await navigate({ to: "/inquiries", search: {} });
			await menu.cases.reload();
			setEditingRecord(null);
			toast.success(
				"title" in patch
					? "笔录名称已修改"
					: patch.archived
						? "笔录已归档"
						: "笔录已恢复",
			);
		} catch (cause) {
			toast.error(inquiryError(cause));
		} finally {
			editorActions.finishMutation();
			lock.current = false;
			setBusy(false);
		}
	};

	return {
		label: "笔录案件菜单",
		title: archived ? "已归档笔录" : "笔录",
		toolbar: (
			<>
				<TooltipIconButton
					label="新建独立笔录"
					disabled={creation.busy || busy}
					onClick={() => {
						if (!lock.current) void creation.create();
					}}
				>
					<FilePlus2Icon />
				</TooltipIconButton>
				<TooltipIconButton
					label="新建案件文件夹"
					disabled={busy}
					onClick={() => setEditing("new")}
				>
					<FolderPlusIcon />
				</TooltipIconButton>
				<TooltipIconButton
					label={archived ? "返回笔录案件" : "查看归档笔录"}
					aria-pressed={archived}
					onClick={() => {
						setArchived(!archived);
						setSearch("");
					}}
				>
					<ArchiveIcon />
				</TooltipIconButton>
			</>
		),
		children: (
			<>
				<WorkspaceMenuSearch
					label="搜索笔录目录"
					placeholder="搜索笔录、被询问人或文件夹"
					maxLength={200}
					value={search}
					onChange={setSearch}
				/>
				<ScrollArea
					className="min-h-0 flex-1"
					contentClassName="w-full min-w-0! px-workspace-gutter pb-workspace-gutter"
				>
					<AsyncStatusBlock
						compact
						loading={menu.cases.loading && !menu.cases.data}
						error={menu.cases.error || error}
						onRetry={menu.cases.reload}
					/>
					{creation.error && (
						<p role="alert" className="p-2 text-destructive-foreground text-xs">
							{creation.error}
						</p>
					)}
					{!menu.cases.loading && !menu.cases.error && !rows.length && (
						<p className="p-2 text-muted-foreground text-xs">
							{search.trim()
								? "没有匹配的笔录或文件夹。"
								: archived
									? "还没有归档笔录或案件。"
									: "还没有笔录，可以新建笔录或案件文件夹。"}
						</p>
					)}
					<Tree tree={tree} aria-label="笔录目录">
						{tree.getItems().map((item) => (
							<InquiryTreeItem
								key={item.getId()}
								item={item}
								busy={busy || creation.busy}
								onCreate={
									archived
										? undefined
										: (caseId) => {
												if (!lock.current) void creation.create(caseId);
											}
								}
								onRename={setEditing}
								onRenameRecord={(row, record) =>
									setEditingRecord({ row, record })
								}
								onArchiveRecord={(row, record) =>
									void mutateRecord(row, record, { archived: !record.archived })
								}
								onArchive={(row) => void mutate(row)}
							/>
						))}
					</Tree>
				</ScrollArea>
				<div className="border-t p-workspace-gutter">
					<Button
						variant="ghost"
						className="w-full justify-start"
						onClick={() => {
							menu.dismiss();
							void navigate({
								to: "/inquiries",
								search: { inquiryView: "inquirers" },
							});
						}}
					>
						<UsersIcon data-icon="inline-start" />
						常用询问人
					</Button>
				</div>
			</>
		),
		dialogs: (
			<Suspense fallback={null}>
				{editingRecord && (
					<InquiryRecordNameDialog
						title={editingRecord.record.title}
						busy={busy}
						onClose={() => setEditingRecord(null)}
						onSubmit={(title) =>
							mutateRecord(editingRecord.row, editingRecord.record, { title })
						}
					/>
				)}
				{editing && (
					<InquiryCaseDialog
						row={editing === "new" ? undefined : editing}
						onClose={() => setEditing(null)}
					/>
				)}
			</Suspense>
		),
	};
}
