/**
 * @file 笔录案件文件夹菜单的内容、操作及弹窗。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：为统一菜单框提供独立笔录、可折叠案件目录及常用询问人入口。
 * 被调用：WorkspaceSecondaryMenu；调用：笔录资源上下文、Eden、共享控件。
 * 预期结果：点击文件夹展开/折叠，点击叶子笔录打开编辑；行操作不再另占一行。
 */

import { Button } from "@leonwillow-electron/ui/components/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { Tree } from "@leonwillow-electron/ui/components/tree";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
	ArchiveIcon,
	FilePlus2Icon,
	FolderPlusIcon,
	SearchIcon,
	UsersIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
	type InquiryCase,
	inquiryError,
	updateInquiryCase,
} from "@/lib/inquiries";
import InquiryCaseDialog from "@/views/inquiries/case-dialog";
import { InquiryIconButton, InquiryState } from "@/views/inquiries/controls";
import { useCreateInquiry } from "@/views/inquiries/use-create-inquiry";
import { useInquiryEditorActions } from "./inquiry-editor-actions";
import { useInquiryNavigation } from "./inquiry-navigation-provider";
import InquiryTreeItem from "./inquiry-tree-item";
import { useInquiryTree } from "./use-inquiry-tree";
import type { WorkspaceMenuContent } from "./workspace-menu";

export default function useInquiryCaseMenu(): WorkspaceMenuContent {
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
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const lock = useRef(false);
	const rows = useMemo(
		() => (menu.cases.data ?? []).filter((row) => row.archived === archived),
		[menu.cases.data, archived],
	);
	const { tree } = useInquiryTree(rows, {
		onOpenRecord: (caseId, recordId) => {
			if (lock.current) return;
			void navigate({
				to: "/inquiries",
				search: { inquiryCaseId: caseId, recordId },
			});
			menu.dismiss();
		},
		onCreateRecord: (caseId) => {
			if (!lock.current) void creation.create(caseId);
		},
		creating: creation.busy || busy,
		query: search.trim(),
	});

	/** 当前编辑笔录先完成保存；失败时中止归档，成功后才离开编辑器。 */
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
	return {
		label: "笔录案件菜单",
		title: archived ? "已归档案件" : "笔录",
		toolbar: (
			<>
				<InquiryIconButton
					label="新建独立笔录"
					disabled={creation.busy || busy}
					onClick={() => {
						if (!lock.current) void creation.create();
					}}
				>
					<FilePlus2Icon />
				</InquiryIconButton>
				<InquiryIconButton
					label="新建案件文件夹"
					disabled={busy}
					onClick={() => setEditing("new")}
				>
					<FolderPlusIcon />
				</InquiryIconButton>
				<InquiryIconButton
					label={archived ? "返回笔录案件" : "查看归档笔录案件"}
					aria-pressed={archived}
					onClick={() => {
						setArchived(!archived);
						setSearch("");
					}}
				>
					<ArchiveIcon />
				</InquiryIconButton>
			</>
		),
		children: (
			<>
				<div className="flex flex-col gap-2 p-workspace-gutter">
					<InputGroup>
						<InputGroupInput
							aria-label="搜索笔录目录"
							placeholder="搜索笔录、被询问人或文件夹"
							maxLength={200}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						<InputGroupAddon align="inline-end">
							<SearchIcon />
						</InputGroupAddon>
					</InputGroup>
				</div>
				<ScrollArea
					className="min-h-0 flex-1"
					contentClassName="w-full min-w-0! px-workspace-gutter pb-workspace-gutter"
				>
					<InquiryState
						loading={menu.cases.loading && !menu.cases.data}
						error={menu.cases.error || error}
						retry={menu.cases.reload}
					/>
					{creation.error && (
						<p role="alert" className="p-2 text-destructive text-xs">
							{creation.error}
						</p>
					)}
					{!menu.cases.loading && !menu.cases.error && !rows.length && (
						<p className="p-2 text-muted-foreground text-sm">
							{search.trim()
								? "没有匹配的笔录或文件夹。"
								: archived
									? "还没有归档案件。"
									: "还没有笔录，可以新建笔录或案件文件夹。"}
						</p>
					)}
					<Tree tree={tree} aria-label="笔录目录">
						{tree.getItems().map((item) => (
							<InquiryTreeItem
								key={item.getId()}
								item={item}
								busy={busy || creation.busy}
								onRename={setEditing}
								onArchive={(row) => void mutate(row)}
							/>
						))}
					</Tree>
				</ScrollArea>
				<div className="border-t p-workspace-gutter">
					<Button
						nativeButton={false}
						variant="ghost"
						className="w-full justify-start"
						render={
							<Link
								to="/inquiries"
								search={{ inquiryView: "inquirers" }}
								onClick={menu.dismiss}
							/>
						}
					>
						<UsersIcon data-icon="inline-start" />
						常用询问人
					</Button>
				</div>
			</>
		),
		dialogs: (
			<>
				{editing && (
					<InquiryCaseDialog
						row={editing === "new" ? undefined : editing}
						onClose={() => setEditing(null)}
					/>
				)}
			</>
		),
	};
}
