/**
 * @file 当前案件账户/主体目录、搜索、筛选与虚拟滚动。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-08
 * 版本作用：完整目录可浏览，DOM 只保留可见条目与键盘焦点条目。
 * 被调用：AnalysisPanel；调用：TanStack Virtual、AccountDirectoryRow、目录筛选。
 * 功能：宽屏以共享菜单宽度固定目录和分隔线；列表独立滚动，键盘翻阅全部账户。
 * 预期结果：不截断账户，不改变图谱分析范围，悬停和筛选不追加网络请求。
 */
import {
	createHoverCardHandle,
	HoverCard,
	HoverCardContent,
} from "@leonwillow-electron/ui/components/hover-card";
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
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { SearchIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FundsAccount } from "@/lib/funds";
import {
	analysisDirectory,
	type NodeMode,
	type RawGraph,
} from "@/lib/funds-analysis";
import {
	type DirectoryEntry,
	emptyDirectoryFilters,
	filterDirectory,
} from "@/lib/funds-directory";
import type { GraphPresentation } from "@/lib/funds-graph-presentation";
import AccountDirectoryFilters from "./account-directory-filters";
import AccountDirectoryRow, { AccountPreview } from "./account-directory-row";
import type { NodeMenuTarget } from "./node-action-menu";

type DirectoryActions = {
	mode: NodeMode;
	full: RawGraph;
	appearances: GraphPresentation;
	account: string;
	onInspect: (id: string) => void;
	onDrill: (id: string) => void;
	onMenu: (target: NodeMenuTarget) => void;
};

/** 数据排序或筛选改变时由父组件重挂载，避免旧滚动位置与键盘索引越界。 */
function DirectoryList({
	entries,
	...actions
}: DirectoryActions & { entries: DirectoryEntry[] }) {
	const scroll = useRef<HTMLDivElement>(null);
	const [preview] = useState(() => createHoverCardHandle<FundsAccount>());
	const previewIntent = useRef<string | null>(null);
	// 点击、菜单和滚动后拒绝旧的延迟打开；新的移入/聚焦才重新授权预览。
	const dismissPreview = () => {
		previewIntent.current = null;
		preview.close();
	};
	const [focusedIndex, setFocusedIndex] = useState(0);
	const pendingFocus = useRef<number | null>(null);
	const rows = useRef(new Map<number, HTMLButtonElement>());
	const getItemKey = useCallback(
		(index: number) => entries[index]?.id ?? index,
		[entries],
	);
	const virtualizer = useVirtualizer<HTMLDivElement, HTMLLIElement>({
		count: entries.length,
		getScrollElement: () => scroll.current,
		getItemKey,
		estimateSize: () => 64,
		overscan: 5,
		// 手动滚动时保留一个焦点条目，避免虚拟卸载将键盘焦点丢到页面顶部。
		rangeExtractor: (range) =>
			[...new Set([...defaultRangeExtractor(range), focusedIndex])].sort(
				(a, b) => a - b,
			),
	});
	const virtualRows = virtualizer.getVirtualItems();
	useLayoutEffect(() => {
		const index = pendingFocus.current;
		if (index === null || !virtualRows.some((row) => row.index === index))
			return;
		rows.current.get(index)?.focus({ preventScroll: true });
		pendingFocus.current = null;
	}, [virtualRows]);
	return (
		<>
			<div
				ref={scroll}
				className="max-h-64 min-h-0 overflow-auto overscroll-contain rounded-lg border xl:max-h-none xl:flex-1"
				style={{ height: virtualizer.getTotalSize() }}
				data-slot="account-directory-scroll"
				onScroll={dismissPreview}
			>
				<ul
					aria-label="账户列表"
					className="relative w-full"
					style={{ height: virtualizer.getTotalSize() }}
				>
					{virtualRows.map((row) => {
						const item = entries[row.index];
						if (!item) return null;
						return (
							<li
								key={row.key}
								data-index={row.index}
								ref={virtualizer.measureElement}
								aria-posinset={row.index + 1}
								aria-setsize={entries.length}
								className="absolute top-0 left-0 w-full"
								style={{ transform: `translateY(${row.start}px)` }}
							>
								<AccountDirectoryRow
									node={item}
									mode={actions.mode}
									handle={preview}
									onPreviewActivate={(id) => {
										previewIntent.current = id;
									}}
									onPreviewDismiss={dismissPreview}
									transactionCount={item.transactionCount}
									ref={(element) => {
										if (element) rows.current.set(row.index, element);
										else rows.current.delete(row.index);
									}}
									tabIndex={row.index === focusedIndex ? 0 : -1}
									aria-pressed={actions.account === item.id}
									onFocus={() => setFocusedIndex(row.index)}
									onClick={() => actions.onInspect(item.id)}
									onDoubleClick={() => actions.onDrill(item.id)}
									onContextMenu={(event) => {
										event.preventDefault();
										actions.onMenu({
											id: item.id,
											x: event.clientX,
											y: event.clientY,
										});
									}}
									onKeyDown={(event) => {
										if (
											event.key === "ContextMenu" ||
											(event.shiftKey && event.key === "F10")
										) {
											event.preventDefault();
											const rect = event.currentTarget.getBoundingClientRect();
											actions.onMenu({
												id: item.id,
												x: rect.right,
												y: rect.top,
											});
											return;
										}
										const page = Math.max(
											1,
											Math.floor(
												(scroll.current?.clientHeight ?? 256) / row.size,
											),
										);
										const targets: Record<string, number> = {
											ArrowDown: row.index + 1,
											ArrowUp: row.index - 1,
											Home: 0,
											End: entries.length - 1,
											PageDown: row.index + page,
											PageUp: row.index - page,
										};
										const target = targets[event.key];
										if (target === undefined) return;
										event.preventDefault();
										const index = Math.max(
											0,
											Math.min(entries.length - 1, target),
										);
										pendingFocus.current = index;
										setFocusedIndex(index);
										virtualizer.scrollToIndex(index, { align: "auto" });
										rows.current.get(index)?.focus({ preventScroll: true });
									}}
									className={`flex w-full flex-col gap-1 p-3 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${row.index < entries.length - 1 ? "border-b" : ""} ${actions.account === item.id ? "bg-primary/10" : ""}`}
								/>
							</li>
						);
					})}
				</ul>
			</div>
			<HoverCard
				handle={preview}
				onOpenChange={(open, details) => {
					if (
						open &&
						(!previewIntent.current ||
							details.trigger?.getAttribute("data-preview-account") !==
								previewIntent.current)
					)
						details.cancel();
				}}
			>
				{({ payload }) => (
					<HoverCardContent
						side="right"
						align="start"
						sideOffset={12}
						showArrow
						className="w-80 p-0"
						aria-label="账户速览"
					>
						<div className="max-h-(--available-height) overflow-y-auto rounded-lg p-4">
							{payload && (
								<AccountPreview
									node={payload}
									mode={actions.mode}
									full={actions.full}
									presentation={actions.appearances[payload.id]}
								/>
							)}
						</div>
					</HoverCardContent>
				)}
			</HoverCard>
		</>
	);
}

export default function AccountDirectory({
	loading,
	...actions
}: DirectoryActions & { loading: boolean }) {
	const [search, setSearch] = useState("");
	const [term, setTerm] = useState("");
	const [filters, setFilters] = useState(emptyDirectoryFilters);
	const all = useMemo(
		() => analysisDirectory(actions.full, ""),
		[actions.full],
	);
	const entries = useMemo(
		() => filterDirectory(all, term, filters, actions.appearances),
		[all, term, filters, actions.appearances],
	);
	// 同一集合保持滚动位置；搜索、模式及筛选结果变化时重置虚拟窗口。
	const listKey = JSON.stringify([
		actions.mode,
		term,
		filters,
		entries.map((item) => item.id),
	]);
	return (
		// 菜单贴齐页头和工作区边界；内边距负责留白，只有列表参与收缩和滚动。
		<aside
			className="flex max-h-1/3 min-h-0 min-w-0 shrink-0 flex-col gap-3 overflow-hidden border-b bg-sidebar p-workspace-gutter xl:max-h-none xl:w-workspace-menu xl:border-r xl:border-b-0"
			aria-label="案件账户"
		>
			<div className="flex shrink-0 items-center gap-2">
				<form
					className="min-w-0 flex-1"
					aria-label="账户搜索"
					onSubmit={(event) => {
						event.preventDefault();
						setTerm(search);
					}}
				>
					<InputGroup>
						<InputGroupInput
							aria-label="搜索账户或户名"
							placeholder="搜索户名或完整账号"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<InputGroupAddon align="inline-end">
							<Tooltip>
								<TooltipTrigger
									render={
										<InputGroupButton
											type="submit"
											size="icon-sm"
											aria-label="搜索账户"
										>
											<SearchIcon />
										</InputGroupButton>
									}
								/>
								<TooltipContent>搜索账户</TooltipContent>
							</Tooltip>
						</InputGroupAddon>
					</InputGroup>
				</form>
				<AccountDirectoryFilters value={filters} onChange={setFilters} />
			</div>
			{loading ? (
				<p role="status" className="p-3 text-muted-foreground text-xs">
					正在读取账户…
				</p>
			) : entries.length ? (
				<DirectoryList key={listKey} entries={entries} {...actions} />
			) : (
				<p className="rounded-lg border p-3 text-muted-foreground text-xs">
					没有找到匹配{actions.mode === "subject" ? "主体" : "账户"}。
				</p>
			)}
			{!loading && (
				<p role="status" className="shrink-0 text-muted-foreground text-xs">
					{entries.length === all.length
						? `共 ${all.length.toLocaleString("zh-CN")}`
						: `${entries.length.toLocaleString("zh-CN")} / ${all.length.toLocaleString("zh-CN")}`}{" "}
					个{actions.mode === "subject" ? "主体" : "账户"}
				</p>
			)}
		</aside>
	);
}
