/**
 * @file 单一文书类型的记录表格、新增入口和文书编辑容器。
 * 创建时间：2026-10-11；修改时间：2026-11-05。
 * 版本作用：类型内检索和分页；新增、查看和编辑在弹窗完成，原列表和筛选保留。
 * 被调用：documents/index；调用：共享表格、document-editor、Eden 文书客户端。
 * 功能与预期结果：切换类型不混入旧记录；普通人员可查看全部、修改本人，管理员可删除。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import { CopyText } from "@leonwillow-electron/ui/components/copy-text";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import { Input } from "@leonwillow-electron/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leonwillow-electron/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@leonwillow-electron/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipText,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type DocumentCatalogType,
	type DocumentDetails,
	type DocumentRow,
	type DocumentType,
	deleteDocument,
	documentError,
	getDocument,
	listDocuments,
} from "@/lib/documents";
import DocumentEditor from "./document-editor";

const pageSize = 30;
const scopes = [
	{ value: "all", label: "全部文书" },
	{ value: "mine", label: "我的文书" },
];

export default function RecordsWorkspace({
	type,
	template,
	userId,
	admin,
}: {
	type: DocumentCatalogType;
	template?: DocumentType;
	userId: string;
	admin: boolean;
}) {
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const [year, setYear] = useState("");
	const [scope, setScope] = useState("all");
	const [page, setPage] = useState(0);
	const [reload, setReload] = useState(0);
	const [rows, setRows] = useState<DocumentRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [editing, setEditing] = useState<string | null>(null);
	const [editorBusy, setEditorBusy] = useState(false);
	const editorSession = useRef(0);
	const activeEditorSession = editorSession.current;
	const openEditor = (id: string | null) => {
		editorSession.current += 1;
		setEditorBusy(false);
		setEditing(id);
	};
	const [details, setDetails] = useState<DocumentDetails>();
	const [detailError, setDetailError] = useState("");
	const [detailReload, setDetailReload] = useState(0);
	const [removing, setRemoving] = useState<DocumentRow | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const parsedYear = year ? Number(year) : undefined;
	const validYear =
		parsedYear === undefined ||
		(Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 9999);
	const canCreate = !type.archived && !!template;

	useEffect(() => {
		const timer = setTimeout(() => {
			setQuery(search.trim());
			setPage(0);
		}, 250);
		return () => clearTimeout(timer);
	}, [search]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reload 是显式刷新触发器。
	useEffect(() => {
		if (!validYear) {
			setLoading(false);
			return;
		}
		let live = true;
		setLoading(true);
		setError("");
		void listDocuments({
			query: {
				typeId: type.id,
				q: query || undefined,
				mine: scope === "mine" ? "true" : "false",
				year: parsedYear,
				offset: page * pageSize,
				limit: pageSize,
			},
		})
			.then((data) => {
				if (!live) return;
				if (page > 0 && page * pageSize >= data.total) {
					setPage(Math.max(0, Math.ceil(data.total / pageSize) - 1));
					return;
				}
				setRows(data.records);
				setTotal(data.total);
			})
			.catch((cause) => {
				if (live) setError(documentError(cause));
			})
			.finally(() => {
				if (live) setLoading(false);
			});
		return () => {
			live = false;
		};
	}, [type.id, query, scope, parsedYear, validYear, page, reload]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 保存和重试需要重取同一记录的详情。
	useEffect(() => {
		setDetails(undefined);
		setDetailError("");
		if (!editing || editing === "new") return;
		let live = true;
		void getDocument(editing)
			.then((data) => {
				if (live) setDetails(data);
			})
			.catch((cause) => {
				if (live) setDetailError(documentError(cause));
			});
		return () => {
			live = false;
		};
	}, [editing, detailReload]);
	const refresh = () => setReload((value) => value + 1);
	const saved = async (id: string) => {
		refresh();
		// 用户已关闭或重新打开弹窗时，旧保存结果不改变当前编辑器。
		if (editorSession.current !== activeEditorSession) return;
		const updated = await getDocument(id);
		if (editorSession.current === activeEditorSession) setDetails(updated);
	};
	/** 标记删除后重新读取当前页；冲突时保留确认框及错误，不回收文号。 */
	const remove = async () => {
		if (!removing || deleting) return;
		setDeleting(true);
		setDeleteError("");
		try {
			await deleteDocument(removing);
			setRemoving(null);
			refresh();
			toast.success("文书已删除，原文号不会重复使用。");
		} catch (cause) {
			setDeleteError(documentError(cause));
		} finally {
			setDeleting(false);
		}
	};
	return (
		<>
			<div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-workspace-gutter">
				<Input
					aria-label="搜索当前类型的文书"
					placeholder="搜索文号、受询问人或取号人"
					maxLength={160}
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					className="w-full sm:w-64"
				/>
				<Select
					items={scopes}
					value={scope}
					onValueChange={(value) => {
						if (value) {
							setScope(value);
							setPage(0);
						}
					}}
				>
					<SelectTrigger aria-label="文书范围">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{scopes.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<Input
					type="number"
					min={2000}
					max={9999}
					aria-label="筛选文号年份"
					aria-invalid={!validYear}
					placeholder="全部年份"
					value={year}
					onChange={(event) => {
						setYear(event.target.value);
						setPage(0);
					}}
					className="w-28"
				/>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon"
								aria-label="刷新文书列表"
								disabled={loading || !validYear}
								onClick={refresh}
							/>
						}
					>
						<RefreshCwIcon />
					</TooltipTrigger>
					<TooltipContent>刷新文书列表</TooltipContent>
				</Tooltip>
				{canCreate && (
					<Button className="sm:ml-auto" onClick={() => openEditor("new")}>
						<PlusIcon data-icon="inline-start" />
						新增文书
					</Button>
				)}
			</div>
			{type.archived && (
				<p className="shrink-0 border-b px-workspace-gutter py-2 text-muted-foreground text-xs">
					该类型已停用，现有文书仍可查看和补填。
				</p>
			)}
			<div className="min-h-0 flex-1" aria-busy={loading}>
				{error || !validYear ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 p-workspace-gutter">
						<p role="alert" className="text-destructive text-sm">
							{!validYear
								? "请输入 2000 至 9999 之间的年份，或清空查看全部年份。"
								: error}
						</p>
						{validYear && (
							<Button variant="outline" onClick={refresh}>
								重新加载
							</Button>
						)}
					</div>
				) : loading ? (
					<div
						role="status"
						className="flex h-full items-center justify-center p-workspace-gutter text-muted-foreground text-sm"
					>
						正在读取文书…
					</div>
				) : (
					<Table
						aria-label={`${type.name}文书记录`}
						containerProps={{ className: "h-full", tabIndex: 0 }}
					>
						<TableHeader className="sticky top-0 z-10 bg-background">
							<TableRow>
								<TableHead className="pl-workspace-gutter">文号</TableHead>
								<TableHead>受询问人 / 事项</TableHead>
								<TableHead>取号人</TableHead>
								<TableHead>取号时间</TableHead>
								<TableHead className="pr-workspace-gutter text-right">
									操作
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="pl-workspace-gutter">
										<CopyText value={row.documentNumber} />
									</TableCell>
									<TableCell>
										<TooltipText content={row.subject}>
											<span className="block max-w-xs truncate">
												{row.subject}
											</span>
										</TooltipText>
									</TableCell>
									<TableCell>{row.ownerName}</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(row.createdAt).toLocaleString("zh-CN", {
											hour12: false,
										})}
									</TableCell>
									<TableCell className="pr-workspace-gutter">
										<div className="flex justify-end gap-1">
											<Button
												size="sm"
												variant="ghost"
												aria-label={`查看${row.documentNumber}`}
												onClick={() => openEditor(row.id)}
											>
												{admin || row.ownerId === userId
													? "查看 / 编辑"
													: "查看"}
											</Button>
											{admin && (
												<Tooltip>
													<TooltipTrigger
														render={
															<Button
																variant="destructive"
																size="icon-sm"
																aria-label={`删除${row.documentNumber}`}
																onClick={() => {
																	setDeleteError("");
																	setRemoving(row);
																}}
															/>
														}
													>
														<Trash2Icon />
													</TooltipTrigger>
													<TooltipContent>删除文书</TooltipContent>
												</Tooltip>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
							{!rows.length && (
								<TableRow>
									<TableCell
										colSpan={5}
										className="p-workspace-gutter text-center text-muted-foreground"
									>
										{query || year || scope === "mine"
											? "没有符合条件的文书。"
											: canCreate
												? "该类型还没有文书，点击右上方“新增文书”开始取号。"
												: "该类型暂无文书。"}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				)}
			</div>
			<footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-workspace-gutter py-3 text-muted-foreground text-xs">
				<span>
					{loading || error || !validYear ? "—" : `共 ${total} 份文书`}
				</span>
				<div className="flex items-center gap-3">
					<Button
						size="sm"
						variant="outline"
						disabled={loading || !validYear || !!error || page === 0}
						onClick={() => setPage((value) => value - 1)}
					>
						上一页
					</Button>
					<span>第 {page + 1} 页</span>
					<Button
						size="sm"
						variant="outline"
						disabled={
							loading || !validYear || !!error || (page + 1) * pageSize >= total
						}
						onClick={() => setPage((value) => value + 1)}
					>
						下一页
					</Button>
				</div>
			</footer>
			<Dialog
				open={!!editing}
				onOpenChange={(open) => {
					if (!open && !editorBusy) openEditor(null);
				}}
			>
				<DialogContent
					showCloseButton={!editorBusy}
					className="flex h-[min(52rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl"
				>
					<DialogHeader className="shrink-0 border-b p-workspace-gutter pr-12">
						<DialogTitle>
							{editing === "new" && !details ? "新增文书" : "文书详情"} ·{" "}
							{type.name}
						</DialogTitle>
						<DialogDescription>
							填写受询问人或事项即可取号；补充内容可折叠，右侧自动预览。
						</DialogDescription>
					</DialogHeader>
					{editing && (details || (editing === "new" && canCreate)) ? (
						<DocumentEditor
							key={activeEditorSession}
							type={template}
							details={details}
							userId={userId}
							admin={admin}
							onSaved={saved}
							onClose={() => openEditor(null)}
							onBusyChange={setEditorBusy}
						/>
					) : (
						<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-workspace-gutter">
							<p
								role={detailError ? "alert" : "status"}
								className="text-muted-foreground text-sm"
							>
								{detailError ||
									(editing === "new"
										? "该类型已停用，无法新增文书。"
										: "正在读取文书…")}
							</p>
							{detailError && (
								<Button
									variant="outline"
									onClick={() => setDetailReload((value) => value + 1)}
								>
									重新加载
								</Button>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={!!removing}
				onOpenChange={(open) => {
					if (!open && !deleting) setRemoving(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>删除文书</DialogTitle>
						<DialogDescription>
							删除 {removing?.documentNumber}
							？记录将不再显示，文号不会回收或重新使用。
						</DialogDescription>
					</DialogHeader>
					{deleteError && (
						<p role="alert" className="text-destructive text-xs">
							{deleteError}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={deleting}
							onClick={() => setRemoving(null)}
						>
							取消
						</Button>
						<Button
							variant="destructive"
							disabled={deleting}
							onClick={() => void remove()}
						>
							{deleting ? "正在删除…" : "确认删除"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
