/**
 * @file 主图标栏右侧的案件菜单。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：沿用二级栏，按置顶/普通/归档组织案件，持久化排序及标记删除。
 * 被调用：WorkspaceLayout；调用：Eden、共享 UI、FundsNavigationProvider、FundsCaseRow。
 * 功能：显式搜索、创建、置顶、拖放排序、独立归档视图和删除确认。
 * 预期结果：无默认选案或关闭按钮；删除不清除原始资料；浮层关闭不丢失对话框状态。
 */
import { Button } from "@leonwillow-electron/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leonwillow-electron/ui/components/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@leonwillow-electron/ui/components/tooltip";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import {
	useLocation,
	useNavigate,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArrowLeftIcon,
	PinIcon,
	PinOffIcon,
	PlusIcon,
	SearchIcon,
} from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import {
	deleteFundsCase,
	fundsError,
	listFundsCases,
	moveFundsCase,
	updateFundsCase,
} from "@/lib/funds";
import CreateCaseDialog from "@/views/funds/create-case-dialog";
import { useFundsResource } from "@/views/funds/use-funds-resource";
import FundsCaseRow, {
	CaseIconAction,
	type CaseRecord,
	type DropTarget,
} from "./funds-case-row";
import { useFundsNavigation } from "./funds-navigation-provider";

export default function FundsCaseSidebar() {
	const menu = useFundsNavigation();
	const { caseId } = useSearch({ strict: false });
	const pathname = useLocation({ select: (location) => location.pathname });
	const navigate = useNavigate();
	const router = useRouter();
	const cases = useFundsResource(listFundsCases);
	const [creating, setCreating] = useState(false);
	const [draft, setDraft] = useState("");
	const [search, setSearch] = useState("");
	const [archived, setArchived] = useState(false);
	const [changed, setChanged] = useState<Record<string, CaseRecord>>({});
	const [deleted, setDeleted] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const busyRef = useRef(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [removing, setRemoving] = useState<CaseRecord | null>(null);
	const [deleteError, setDeleteError] = useState("");
	const [dragging, setDragging] = useState("");
	const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
	const records = (cases.data ?? [])
		.map((r) => changed[r.id] ?? r)
		.filter((r) => !deleted.includes(r.id));
	const visible = records
		.filter(
			(r) =>
				r.archived === archived &&
				r.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
		)
		.sort(
			(a, b) =>
				a.sortOrder - b.sortOrder ||
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
				a.id.localeCompare(b.id),
		);
	const groups = archived
		? [{ label: "已归档案件", rows: visible }]
		: [
				{ label: "置顶", rows: visible.filter((r) => r.pinned) },
				{ label: "案件", rows: visible.filter((r) => !r.pinned) },
			];
	const merge = (rows: CaseRecord[]) =>
		setChanged((current) => ({
			...current,
			...Object.fromEntries(rows.map((r) => [r.id, r])),
		}));
	const begin = () => {
		if (busyRef.current) return false;
		busyRef.current = true;
		setBusy(true);
		setError("");
		setMessage("");
		return true;
	};
	const finish = () => {
		busyRef.current = false;
		setBusy(false);
	};
	const update = async (
		record: CaseRecord,
		patch: { pinned?: boolean; archived?: boolean },
	) => {
		if (!begin()) return;
		try {
			merge([await updateFundsCase(record.id, patch)]);
			if (patch.archived && caseId === record.id)
				await navigate({ to: "/funds", search: {} });
			setMessage(
				patch.archived === true
					? "已归档"
					: patch.archived === false
						? "已恢复"
						: patch.pinned
							? "已置顶"
							: "已取消置顶",
			);
			await router.invalidate();
		} catch (e) {
			setError(fundsError(e));
		} finally {
			finish();
		}
	};
	const move = async (
		record: CaseRecord,
		targetId: string,
		placement: "before" | "after",
	) => {
		if (record.id === targetId || !begin()) return;
		try {
			merge(await moveFundsCase(record.id, targetId, placement));
			setMessage("案件顺序已保存");
		} catch (e) {
			setError(fundsError(e));
		} finally {
			finish();
		}
	};
	const remove = async () => {
		if (!removing || !begin()) return;
		setDeleteError("");
		try {
			await deleteFundsCase(removing.id);
			setDeleted((current) => [...current, removing.id]);
			if (caseId === removing.id) await navigate({ to: "/funds", search: {} });
			setRemoving(null);
			setMessage("案件已删除，后台资料保留。");
			await router.invalidate();
		} catch (e) {
			setDeleteError(fundsError(e));
		} finally {
			finish();
		}
	};
	const switchView = () => {
		setArchived(!archived);
		setDraft("");
		setSearch("");
		setError("");
		setMessage("");
	};
	const endDrag = () => {
		setDragging("");
		setDropTarget(null);
		menu.setDragging(false);
		menu.scheduleClose();
	};
	const allowedTarget = (record: CaseRecord) => {
		const source = records.find((r) => r.id === dragging);
		return (
			!busy &&
			source &&
			source.id !== record.id &&
			source.archived === record.archived &&
			(archived || source.pinned === record.pinned)
		);
	};
	const position = (event: DragEvent): "before" | "after" =>
		event.clientY <
		event.currentTarget.getBoundingClientRect().top +
			event.currentTarget.getBoundingClientRect().height / 2
			? "before"
			: "after";
	return (
		<>
			<CreateCaseDialog
				open={creating}
				onOpenChange={setCreating}
				onCreated={() => {
					setArchived(false);
					setDraft("");
					setSearch("");
					void cases.reload();
					menu.dismiss();
				}}
			/>
			<Dialog
				open={!!removing}
				onOpenChange={(open) => {
					if (!open && !busy) setRemoving(null);
				}}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>删除案件</DialogTitle>
						<DialogDescription>
							“{removing?.name}
							”将从案件列表中移除。原始文件、流水和图数据会保留，未完成的后台任务将停止。
						</DialogDescription>
					</DialogHeader>
					{deleteError && (
						<p role="alert" className="text-destructive text-sm">
							{deleteError}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setRemoving(null)}
						>
							取消
						</Button>
						<Button
							variant="destructive"
							disabled={busy}
							onClick={() => void remove()}
						>
							{busy ? "正在删除…" : "确认删除"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{menu.visible && (
				<aside
					id="funds-case-menu"
					ref={menu.panelRef}
					aria-label="案件菜单"
					onPointerEnter={menu.show}
					onPointerLeave={menu.scheduleClose}
					onFocusCapture={menu.show}
					onBlurCapture={menu.scheduleClose}
					className={cn(
						"absolute inset-y-0 left-0 z-40 flex w-60 max-w-full shrink-0 flex-col border-r bg-sidebar",
						menu.docked ? "md:relative md:z-auto" : "shadow-lg",
					)}
				>
					<div
						data-slot="workspace-header"
						className="flex h-workspace-header shrink-0 items-center justify-between gap-3 border-b px-4"
					>
						<div className="flex items-center gap-1">
							{archived && (
								<CaseIconAction
									size="icon"
									label="返回案件列表"
									onClick={switchView}
								>
									<ArrowLeftIcon />
								</CaseIconAction>
							)}
							<h2 className="font-semibold text-base">
								{archived ? "已归档" : "案件"}
							</h2>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							{!archived && (
								<>
									<CaseIconAction
										size="icon"
										label="新增案件"
										onClick={() => setCreating(true)}
									>
										<PlusIcon />
									</CaseIconAction>
									<CaseIconAction
										size="icon"
										label="查看已归档案件"
										onClick={switchView}
									>
										<ArchiveIcon />
									</CaseIconAction>
								</>
							)}
							<CaseIconAction
								size="icon"
								keepTooltipOnClick
								label={menu.pinned ? "取消固定案件菜单" : "固定案件菜单"}
								aria-pressed={menu.pinned}
								onClick={menu.togglePinned}
							>
								{menu.pinned ? <PinOffIcon /> : <PinIcon />}
							</CaseIconAction>
						</div>
					</div>
					<search>
						<form
							aria-label="案件搜索"
							className="p-3 pb-2"
							onSubmit={(e) => {
								e.preventDefault();
								setSearch(draft);
							}}
						>
							<InputGroup>
								<InputGroupInput
									aria-label="搜索案件"
									placeholder={archived ? "搜索已归档案件" : "搜索案件"}
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
								/>
								<InputGroupAddon align="inline-end">
									<Tooltip>
										<TooltipTrigger
											render={
												<InputGroupButton
													type="submit"
													size="icon-sm"
													aria-label="执行案件搜索"
												>
													<SearchIcon />
												</InputGroupButton>
											}
										/>
										<TooltipContent>搜索案件</TooltipContent>
									</Tooltip>
								</InputGroupAddon>
							</InputGroup>
						</form>
					</search>
					<p id="case-sort-help" className="sr-only">
						拖拽调整分组内顺序，或按 Alt 加上、下方向键移动案件。
					</p>
					<p role="status" className="sr-only">
						{message}
					</p>
					{error && (
						<p role="alert" className="px-5 pb-3 text-destructive text-xs">
							{error}
						</p>
					)}
					<nav
						aria-label={archived ? "已归档案件列表" : "案件列表"}
						aria-busy={busy || cases.loading}
						className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
					>
						{cases.loading && (
							<p role="status" className="p-2 text-muted-foreground text-sm">
								正在读取案件…
							</p>
						)}
						{cases.error && (
							<div role="alert" className="flex flex-col gap-2 p-2 text-sm">
								<p>{cases.error}</p>
								<Button variant="outline" onClick={() => void cases.reload()}>
									重试读取案件
								</Button>
							</div>
						)}
						{groups
							.filter((group) => group.rows.length > 0)
							.map((group) => (
								<section
									key={group.label}
									aria-label={group.label}
									className="mt-4 first:mt-2"
								>
									{!archived && (
										<h3 className="px-2 pb-2 font-medium text-muted-foreground text-xs">
											{group.label}
										</h3>
									)}
									<ul className="flex flex-col gap-1">
										{group.rows.map((record) => (
											<FundsCaseRow
												key={record.id}
												record={record}
												selected={record.id === caseId}
												archived={archived}
												busy={busy}
												to={
													pathname === "/funds/cases"
														? "/funds/cases"
														: "/funds"
												}
												dragging={dragging}
												dropTarget={dropTarget}
												onSelect={menu.dismiss}
												onUpdate={(r, p) => void update(r, p)}
												onDelete={(r) => {
													setRemoving(r);
													setDeleteError("");
												}}
												onDragStart={(r, e) => {
													setDragging(r.id);
													menu.setDragging(true);
													e.dataTransfer.effectAllowed = "move";
													e.dataTransfer.setData(
														"application/x-funds-case",
														r.id,
													);
												}}
												onDragEnd={endDrag}
												onDragOver={(r, e) => {
													if (allowedTarget(r)) {
														e.preventDefault();
														e.dataTransfer.dropEffect = "move";
														setDropTarget({ id: r.id, placement: position(e) });
													} else setDropTarget(null);
												}}
												onDrop={(r, e) => {
													if (allowedTarget(r)) {
														e.preventDefault();
														const source = records.find(
															(item) => item.id === dragging,
														);
														if (source) void move(source, r.id, position(e));
													}
													endDrag();
												}}
												onKeyboardMove={(r, direction) => {
													const target =
														group.rows[
															group.rows.findIndex((item) => item.id === r.id) +
																direction
														];
													if (target)
														void move(
															r,
															target.id,
															direction < 0 ? "before" : "after",
														);
												}}
											/>
										))}
									</ul>
								</section>
							))}
						{!cases.loading && !cases.error && visible.length === 0 && (
							<p className="p-2 text-muted-foreground text-sm">
								{search.trim()
									? "没有匹配的案件"
									: archived
										? "暂无归档案件"
										: "还没有案件，点击上方加号创建。"}
							</p>
						)}
					</nav>
				</aside>
			)}
		</>
	);
}
