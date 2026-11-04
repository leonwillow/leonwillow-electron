/**
 * @file 笔录目录的 Headless Tree 数据、分页和路由选中适配。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：持续挂载的菜单 Hook 持有目录页缓存，请求仅在文件夹展开后发起。
 * 被调用：useInquiryCaseMenu；调用：笔录导航上下文、Eden、Headless Tree。
 * 预期结果：浮窗关闭不丢失展开与分页，旧请求不能覆盖新版目录，点击叶子立即打开。
 */
import {
	type FeatureImplementation,
	hotkeysCoreFeature,
	syncDataLoaderFeature,
	type TreeInstance,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type InquiryCase,
	type InquiryRow,
	inquiryError,
	listInquiryRecords,
} from "@/lib/inquiries";
import { useInquiryNavigation } from "./inquiry-navigation-provider";

export type InquiryTreeNode = {
	kind:
		| "root"
		| "folder"
		| "record"
		| "create"
		| "loading"
		| "error"
		| "empty"
		| "previous"
		| "next";
	name: string;
	caseId?: string;
	recordId?: string;
	row?: InquiryCase;
	record?: Pick<InquiryRow, "id" | "title" | "revision" | "status">;
	disabled?: boolean;
	error?: string;
};

type FolderPage = {
	key: string;
	offset: number;
	data?: Awaited<ReturnType<typeof listInquiryRecords>>;
	error?: string;
};
type InquiryTreeOptions = {
	onOpenRecord: (caseId: string, recordId: string) => void;
	onCreateRecord: (caseId: string) => void;
	creating?: boolean;
	query?: string;
	status?: "draft" | "final";
};

const rootId = "inquiry-root";
const folderPrefix = "folder:";
const pageSize = 30;
const folderId = (id: string) => `${folderPrefix}${id}`;
const recordId = (caseId: string, id: string) => `record:${caseId}:${id}`;
const pageKey = (row: InquiryCase, offset: number, filterKey: string) =>
	JSON.stringify([row.updatedAt, row.recordCount, offset, filterKey]);
const lastOffset = (total: number) =>
	Math.max(0, Math.ceil(total / pageSize) - 1) * pageSize;

// 导航选中仅来自当前路由；文件夹和分页操作不会改写正在编辑的笔录选中态。
const routeSelectionFeature: FeatureImplementation<InquiryTreeNode> = {
	key: "inquiry-route-selection",
	itemInstance: {
		isSelected: ({ tree, itemId }) =>
			tree.getState().selectedItems.includes(itemId),
		getProps: ({ item, prev }) => ({
			...prev?.(),
			"aria-selected": item.isSelected() ? "true" : "false",
			"aria-disabled": item.getItemData().disabled || undefined,
		}),
	},
};

function activateFocusedItem(
	event: KeyboardEvent,
	tree: TreeInstance<InquiryTreeNode>,
) {
	const item = tree.getFocusedItem();
	if (!item || item.getItemData().disabled) return;
	// div 树节点没有原生按钮激活行为；内部行操作仍由自己的按钮接收按键。
	if (event.target !== item.getElement()) return;
	event.preventDefault();
	if (item.isFolder()) {
		if (item.isExpanded()) item.collapse();
		else item.expand();
	} else item.primaryAction();
}

/**
 * rows 为当前过滤后的稳定目录数组。缓存归调用此 Hook 的菜单控制器所有；卸载时失效在途请求。
 * 仅展开的文件夹按 30 条加载；修订时间、数量、筛选或页码变化会隐藏旧页并刷新，错误节点可重试。
 */
export function useInquiryTree(
	rows: InquiryCase[],
	{
		onOpenRecord,
		onCreateRecord,
		creating = false,
		query = "",
		status,
	}: InquiryTreeOptions,
) {
	const { expandedCases, setExpandedCases } = useInquiryNavigation();
	const search = useSearch({ strict: false });
	const filterKey = JSON.stringify([query, status]);
	const filtered = !!query || !!status;
	const activeFilterKey = useRef(filterKey);
	activeFilterKey.current = filterKey;
	const [collapsedMatches, setCollapsedMatches] = useState<{
		key: string;
		ids: ReadonlySet<string>;
	}>({ key: filterKey, ids: new Set() });
	const visibleExpandedCases = useMemo(
		() =>
			filtered
				? new Set(
						rows
							.filter(
								(row) =>
									row.kind === "folder" &&
									(collapsedMatches.key !== filterKey ||
										!collapsedMatches.ids.has(row.id)),
							)
							.map((row) => row.id),
					)
				: expandedCases,
		[filtered, rows, collapsedMatches, filterKey, expandedCases],
	);
	const [pages, setPages] = useState(() => new Map<string, FolderPage>());
	const [offsetState, setOffsetState] = useState(() => ({
		key: filterKey,
		values: new Map<string, number>(),
	}));
	const offsets = useMemo(
		() =>
			offsetState.key === filterKey
				? offsetState.values
				: new Map<string, number>(),
		[offsetState, filterKey],
	);
	const [focusedItem, setFocusedItem] = useState<string | null>(null);
	const requests = useRef(new Map<string, { key: string; token: symbol }>());
	const mounted = useRef(true);
	const treeHadFocus = useRef(false);
	useEffect(() => {
		mounted.current = true;
		const pending = requests.current;
		return () => {
			mounted.current = false;
			pending.clear();
		};
	}, []);

	const setOffset = useCallback(
		(caseId: string, offset: number) => {
			setOffsetState((current) => ({
				key: filterKey,
				values: new Map(current.key === filterKey ? current.values : []).set(
					caseId,
					offset,
				),
			}));
		},
		[filterKey],
	);
	const loadPage = useCallback(
		async (row: InquiryCase, offset: number) => {
			const key = pageKey(row, offset, filterKey);
			if (requests.current.get(row.id)?.key === key) return;
			const token = Symbol(row.id);
			requests.current.set(row.id, { key, token });
			setPages((current) => new Map(current).set(row.id, { key, offset }));
			try {
				// 文件夹名称匹配时保留其所有符合状态的子项，否则搜索子笔录。
				const q = row.name
					.toLocaleLowerCase()
					.includes(query.toLocaleLowerCase())
					? undefined
					: query;
				const data = await listInquiryRecords(row.id, { offset, q, status });
				if (
					!mounted.current ||
					activeFilterKey.current !== filterKey ||
					requests.current.get(row.id)?.token !== token
				)
					return;
				// 删除最后一页的末条后回到仍然有效的页，随后按新页码重载。
				if (offset > lastOffset(data.total))
					setOffset(row.id, lastOffset(data.total));
				setPages((current) =>
					new Map(current).set(row.id, { key, offset, data }),
				);
			} catch (cause) {
				if (
					!mounted.current ||
					activeFilterKey.current !== filterKey ||
					requests.current.get(row.id)?.token !== token
				)
					return;
				setPages((current) =>
					new Map(current).set(row.id, {
						key,
						offset,
						error: inquiryError(cause),
					}),
				);
			} finally {
				if (requests.current.get(row.id)?.token === token)
					requests.current.delete(row.id);
			}
		},
		[filterKey, query, status, setOffset],
	);

	useEffect(() => {
		for (const row of rows) {
			if (row.kind !== "folder" || !visibleExpandedCases.has(row.id)) continue;
			const offset = Math.min(
				offsets.get(row.id) ?? 0,
				lastOffset(row.recordCount),
			);
			const page = pages.get(row.id);
			if (
				page?.key !== pageKey(row, offset, filterKey) ||
				(!page.data && !page.error)
			)
				void loadPage(row, offset);
		}
	}, [rows, visibleExpandedCases, offsets, pages, loadPage, filterKey]);

	const model = useMemo(() => {
		const nodes = new Map<string, InquiryTreeNode>([
			[rootId, { kind: "root", name: "笔录目录" }],
		]);
		const children = new Map<string, string[]>([[rootId, []]]);
		const add = (parent: string, id: string, node: InquiryTreeNode) => {
			nodes.set(id, node);
			children.get(parent)?.push(id);
		};
		for (const row of rows) {
			if (row.kind === "standalone") {
				if (row.record)
					add(rootId, recordId(row.id, row.record.id), {
						kind: "record",
						name: row.record.title,
						caseId: row.id,
						recordId: row.record.id,
						record: row.record,
						row,
					});
				continue;
			}
			const id = folderId(row.id);
			add(rootId, id, { kind: "folder", name: row.name, caseId: row.id, row });
			children.set(id, []);
			const offset = Math.min(
				offsets.get(row.id) ?? 0,
				lastOffset(row.recordCount),
			);
			const cached = pages.get(row.id);
			const page =
				cached?.key === pageKey(row, offset, filterKey) ? cached : undefined;
			const addAction = (
				kind: InquiryTreeNode["kind"],
				name: string,
				disabled = false,
				error?: string,
			) =>
				add(id, `${kind}:${row.id}`, {
					kind,
					name,
					caseId: row.id,
					row,
					disabled,
					error,
				});
			if (page?.error)
				addAction("error", "加载失败，点击重试", false, page.error);
			else if (!page?.data) addAction("loading", "正在加载笔录…", true);
			if (page?.data) {
				for (const record of page.data.records)
					add(id, recordId(row.id, record.id), {
						kind: "record",
						name: record.title,
						caseId: row.id,
						recordId: record.id,
						record,
						row,
					});
				if (!page.data.total)
					addAction(
						"empty",
						filtered ? "此文件夹没有匹配的笔录。" : "此文件夹还没有笔录。",
						true,
					);
				if (offset > 0) addAction("previous", "上一页");
				if (offset + pageSize < page.data.total) addAction("next", "下一页");
			}
			if (!row.archived) addAction("create", "新建笔录", creating);
		}
		return { nodes, children };
	}, [rows, pages, offsets, creating, filterKey, filtered]);
	const previousNodes = useRef(model.nodes);
	const expandedItems = useMemo(
		() => [...visibleExpandedCases].map(folderId),
		[visibleExpandedCases],
	);
	const selectedItems = useMemo(
		() =>
			search.inquiryCaseId && search.recordId
				? [recordId(search.inquiryCaseId, search.recordId)]
				: [],
		[search.inquiryCaseId, search.recordId],
	);
	const tree = useTree<InquiryTreeNode>({
		rootItemId: rootId,
		features: [
			syncDataLoaderFeature,
			hotkeysCoreFeature,
			routeSelectionFeature,
		],
		state: { expandedItems, selectedItems, focusedItem },
		setFocusedItem,
		setExpandedItems: (value) => {
			const next = typeof value === "function" ? value(expandedItems) : value;
			const ids = next
				.filter((id) => id.startsWith(folderPrefix))
				.map((id) => id.slice(folderPrefix.length));
			if (filtered) {
				const expanded = new Set(ids);
				setCollapsedMatches({
					key: filterKey,
					ids: new Set(
						rows
							.filter((row) => row.kind === "folder" && !expanded.has(row.id))
							.map((row) => row.id),
					),
				});
			} else setExpandedCases(ids);
		},
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().kind === "folder",
		dataLoader: {
			getItem: (id) =>
				model.nodes.get(id) ?? { kind: "empty", name: "", disabled: true },
			getChildren: (id) => model.children.get(id) ?? [],
		},
		onPrimaryAction: (item) => {
			const node = item.getItemData();
			if (node.disabled || !node.caseId) return;
			if (node.kind === "record" && node.recordId)
				onOpenRecord(node.caseId, node.recordId);
			else if (node.kind === "create") onCreateRecord(node.caseId);
			else if (node.row) {
				const offset = pages.get(node.caseId)?.offset ?? 0;
				if (node.kind === "error") void loadPage(node.row, offset);
				else if (node.kind === "previous")
					setOffset(node.caseId, Math.max(0, offset - pageSize));
				else if (node.kind === "next")
					setOffset(node.caseId, offset + pageSize);
			}
		},
		hotkeys: {
			customActivate: { hotkey: "Enter", handler: activateFocusedItem },
			customActivateSpace: { hotkey: "Space", handler: activateFocusedItem },
		},
	});
	useEffect(() => {
		const trackFocus = (event: FocusEvent) => {
			treeHadFocus.current =
				event.target instanceof Node &&
				!!tree.getElement()?.contains(event.target);
		};
		const trackPointer = (event: PointerEvent) => {
			if (
				!(event.target instanceof Node) ||
				!tree.getElement()?.contains(event.target)
			)
				treeHadFocus.current = false;
		};
		const clearFocus = () => {
			treeHadFocus.current = false;
		};
		document.addEventListener("focusin", trackFocus);
		document.addEventListener("pointerdown", trackPointer, true);
		window.addEventListener("blur", clearFocus);
		return () => {
			document.removeEventListener("focusin", trackFocus);
			document.removeEventListener("pointerdown", trackPointer, true);
			window.removeEventListener("blur", clearFocus);
		};
	}, [tree]);
	useEffect(() => {
		tree.rebuildTree();
		const focusedId = tree.getState().focusedItem;
		if (focusedId && !model.nodes.has(focusedId)) {
			const previousCaseId = previousNodes.current.get(focusedId)?.caseId;
			const nextItem =
				tree
					.getItems()
					.find((item) => item.getId() === folderId(previousCaseId ?? "")) ??
				tree.getItems()[0];
			if (nextItem) nextItem.setFocused();
			else setFocusedItem(null);
			// 翻页移除了原节点时恢复实际焦点；搜索框、弹窗或已关闭的浮层不能被抢焦点。
			const container = tree.getElement();
			if (
				nextItem &&
				container &&
				treeHadFocus.current &&
				(document.activeElement === document.body ||
					container.contains(document.activeElement))
			)
				tree.updateDomFocus();
		}
		previousNodes.current = model.nodes;
	}, [tree, model]);
	return { tree };
}
