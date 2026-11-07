/**
 * @file 计算器方案的树目录及新建、改名、归档与恢复操作。
 * 创建时间：2026-11-05；修改时间：2026-11-07。
 * 版本作用：目录统一管理两类方案，弹窗独立于浮动菜单，写操作先协调当前编辑器。
 * 被调用：WorkspaceSecondaryMenu；调用：ReUI Tree、目录 Provider、Eden 和 Sonner。
 * 预期结果：路由决定选择，悬停显示同行操作；保存失败保留输入，停用方案通过归档管理。
 */

import {
	hotkeysCoreFeature,
	syncDataLoaderFeature,
	type TreeInstance,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Button } from "@leonwillow-electron/ui/components/button";
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
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@leonwillow-electron/ui/components/input-group";
import { ScrollArea } from "@leonwillow-electron/ui/components/scroll-area";
import { Tree } from "@leonwillow-electron/ui/components/tree";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { ArchiveIcon, RotateCwIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type CalculatorKind,
	type CalculatorSummary,
	calculatorDirectory,
	calculatorKinds,
} from "@/lib/calculator-directory";
import { calculatorError } from "@/lib/calculators";
import { randomUUID } from "@/lib/uuid";
import { InquiryIconButton } from "@/views/inquiries/controls";
import { useCalculatorNavigation } from "./calculator-navigation-provider";
import CalculatorTreeItem, {
	type CalculatorNode,
} from "./calculator-tree-item";
import type { WorkspaceMenuContent } from "./workspace-menu";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

type Editing = {
	kind: CalculatorKind;
	row?: CalculatorSummary;
	requestId: string;
};
const recordId = (kind: CalculatorKind, id: string) => `${kind}:${id}`;
function activate(event: KeyboardEvent, tree: TreeInstance<CalculatorNode>) {
	const item = tree.getFocusedItem();
	if (!item || event.target !== item.getElement()) return;
	event.preventDefault();
	if (item.isFolder()) {
		if (item.isExpanded()) item.collapse();
		else item.expand();
	} else item.primaryAction();
}
export default function useCalculatorMenu(): WorkspaceMenuContent {
	const menu = useWorkspaceNavigation();
	const directory = useCalculatorNavigation();
	const navigate = useNavigate();
	const pathname = useLocation({
		select: (s) => s.pathname.replace(/\/$/, ""),
	});
	const search = useSearch({ strict: false });
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState<Editing | null>(null);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const open = (kind: CalculatorKind, id?: string) => {
		if (lock.current) return;
		void navigate({
			to: calculatorDirectory[kind].to,
			search: { scenarioId: id },
		});
		menu.dismiss();
	};
	const create = (kind: CalculatorKind) => {
		if (!lock.current) {
			setName("");
			setEditing({ kind, requestId: randomUUID() });
		}
	};
	const rename = (kind: CalculatorKind, row: CalculatorSummary) => {
		if (!lock.current) {
			setName(row.name);
			setEditing({ kind, row, requestId: "" });
		}
	};
	const mutate = async (
		kind: CalculatorKind,
		row: CalculatorSummary,
		patch: { name?: string; archived?: boolean },
	) => {
		if (lock.current) return false;
		lock.current = true;
		setBusy(true);
		try {
			const prepared = await directory.prepare(kind, row.id);
			if (prepared === null) return false;
			const revision = prepared ?? row.revision;
			const result = await calculatorDirectory[kind].update(
				row.id,
				revision,
				patch,
			);
			directory.accept(kind, result);
			toast.success(
				patch.name !== undefined
					? "方案已重命名"
					: patch.archived
						? "方案已归档"
						: "方案已恢复",
			);
			return true;
		} catch (cause) {
			toast.error("方案操作失败", { description: calculatorError(cause) });
			void directory.reload(kind);
			return false;
		} finally {
			directory.finish();
			lock.current = false;
			setBusy(false);
		}
	};
	const model = useMemo(() => {
		const nodes = new Map<string, CalculatorNode>();
		const children = new Map<string, string[]>([
			["root", [...calculatorKinds]],
		]);
		for (const kind of calculatorKinds) {
			const config = calculatorDirectory[kind];
			nodes.set(kind, { kind, type: "group", name: config.title });
			const resource = directory.resources[kind];
			const ids: string[] = [];
			for (const row of resource.rows.filter(
				(row) =>
					row.archived === directory.archived &&
					row.name
						.toLocaleLowerCase()
						.includes(query.trim().toLocaleLowerCase()),
			)) {
				const id = recordId(kind, row.id);
				ids.push(id);
				nodes.set(id, { kind, type: "record", name: row.name, row });
			}
			if (resource.error || resource.loading) {
				const id = `${kind}:status`;
				ids.push(id);
				nodes.set(id, {
					kind,
					type: resource.error ? "error" : "loading",
					name: resource.error ? "加载失败，点击重试" : "正在加载…",
				});
			}
			children.set(kind, ids);
		}
		return { nodes, children };
	}, [directory.resources, directory.archived, query]);
	const tree = useTree<CalculatorNode>({
		rootItemId: "root",
		features: [syncDataLoaderFeature, hotkeysCoreFeature],
		state: { expandedItems: directory.expanded },
		setExpandedItems: directory.setExpanded,
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().type === "group",
		dataLoader: {
			getItem: (id) =>
				model.nodes.get(id) ?? { kind: "vat", type: "loading", name: "" },
			getChildren: (id) => model.children.get(id) ?? [],
		},
		onPrimaryAction: (item) => {
			if (lock.current) return;
			const node = item.getItemData();
			if (node.type === "record") open(node.kind, node.row?.id);
			else if (node.type === "error") void directory.reload(node.kind);
		},
		hotkeys: {
			customActivate: { hotkey: "Enter", handler: activate },
			customActivateSpace: { hotkey: "Space", handler: activate },
		},
	});
	useEffect(() => {
		tree.rebuildTree();
		const focused = tree.getState().focusedItem;
		if (focused && !model.nodes.has(focused)) {
			const parent = calculatorKinds.find((kind) => focused.startsWith(kind));
			if (parent) {
				tree.getItemInstance(parent).setFocused();
				if (tree.getElement() && document.activeElement === document.body)
					tree.updateDomFocus();
			}
		}
	}, [tree, model]);
	return {
		label: "计算器菜单",
		title: directory.archived ? "已归档方案" : "计算器",
		toolbar: (
			<>
				<InquiryIconButton
					label={directory.archived ? "查看未归档方案" : "查看归档方案"}
					variant={directory.archived ? "warning" : "ghost"}
					aria-pressed={directory.archived}
					onClick={() => directory.setArchived(!directory.archived)}
				>
					<ArchiveIcon />
				</InquiryIconButton>
				<InquiryIconButton
					label="刷新方案目录"
					disabled={busy}
					onClick={() => {
						for (const kind of calculatorKinds) void directory.reload(kind);
					}}
				>
					<RotateCwIcon />
				</InquiryIconButton>
			</>
		),
		children: (
			<>
				<div className="p-workspace-gutter">
					<InputGroup>
						<InputGroupInput
							aria-label="搜索测算方案"
							placeholder="搜索测算方案"
							value={query}
							onChange={(e) => {
								setQuery(e.target.value);
								directory.setExpanded([...calculatorKinds]);
							}}
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
					<Tree tree={tree} aria-label="计算器目录">
						{tree.getItems().map((item) => {
							const node = item.getItemData();
							const selected =
								node.type === "record" &&
								pathname === calculatorDirectory[node.kind].to &&
								search.scenarioId === node.row?.id;
							return (
								<CalculatorTreeItem
									key={item.getId()}
									item={item}
									selected={selected}
									busy={busy}
									onCreate={create}
									onRename={rename}
									onArchive={(kind, row) =>
										void mutate(kind, row, { archived: !row.archived })
									}
								/>
							);
						})}
					</Tree>
				</ScrollArea>
			</>
		),
		dialogs: (
			<>
				<Dialog
					open={!!editing}
					onOpenChange={(value) => {
						if (!value && !busy) setEditing(null);
					}}
				>
					<DialogContent showCloseButton={!busy}>
						<DialogHeader>
							<DialogTitle>
								{editing?.row ? "重命名方案" : "新建方案"}
							</DialogTitle>
							<DialogDescription>
								{editing ? calculatorDirectory[editing.kind].title : "计算器"}
								的方案独立保存到当前账号。
							</DialogDescription>
						</DialogHeader>
						<form
							className="flex flex-col gap-4"
							onSubmit={async (e) => {
								e.preventDefault();
								if (!editing || lock.current) return;
								if (!name.trim()) {
									toast.error("请输入方案名称");
									return;
								}
								if (editing.row) {
									if (await mutate(editing.kind, editing.row, { name }))
										setEditing(null);
									return;
								}
								lock.current = true;
								setBusy(true);
								try {
									const row = await calculatorDirectory[editing.kind].create(
										name,
										editing.requestId,
									);
									directory.upsert(editing.kind, row);
									directory.setArchived(false);
									directory.setExpanded((old) => [
										...new Set([...old, editing.kind]),
									]);
									setEditing(null);
									lock.current = false;
									open(editing.kind, row.id);
								} catch (cause) {
									toast.error("创建方案失败", {
										description: calculatorError(cause),
									});
								} finally {
									lock.current = false;
									setBusy(false);
								}
							}}
						>
							<Field>
								<FieldLabel htmlFor="calculator-directory-name">
									方案名称
								</FieldLabel>
								<Input
									id="calculator-directory-name"
									autoFocus
									value={name}
									maxLength={80}
									disabled={busy}
									onChange={(e) => setName(e.target.value)}
								/>
							</Field>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() => setEditing(null)}
								>
									取消
								</Button>
								<Button type="submit" disabled={busy}>
									{busy ? "正在保存…" : "保存"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</>
		),
	};
}
