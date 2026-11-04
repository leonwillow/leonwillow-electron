/**
 * @file 基于 ReUI 与 Headless Tree 的共享树组件。
 * 创建时间：2026-11-04
 * 修改时间：2026-11-04
 * 版本作用：共享 UI 基础层，提供树容器、节点、标签及拖放指示线。
 * 被调用：Web 笔录目录。
 * 调用：Base UI、Headless Tree、Lucide、共享样式工具与尺寸令牌。
 * 功能：组合树实例的可访问属性、键盘行为、展开状态和自定义渲染。
 * 预期结果：业务管理节点数据与路由，共享组件统一层级缩进和选中反馈。
 */
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { ItemInstance, TreeInstance } from "@headless-tree/core";
import { cn } from "@leonwillow-electron/ui/lib/utils";
import { ChevronDownIcon, MinusIcon, PlusIcon } from "lucide-react";
import {
	type CSSProperties,
	createContext,
	type HTMLAttributes,
	useContext,
} from "react";

type ToggleIconType = "chevron" | "plus-minus";
type TreeIndent = number | string;
type TreeLabelItem = Pick<
	ItemInstance<unknown>,
	"isFolder" | "isExpanded" | "getItemName"
>;
type TreeContainerInstance = Pick<TreeInstance<unknown>, "getContainerProps"> &
	Partial<Pick<TreeInstance<unknown>, "getDragLineStyle">>;

interface TreeContextValue {
	indent: TreeIndent;
	currentItem?: TreeLabelItem;
	tree?: TreeContainerInstance;
	toggleIconType: ToggleIconType;
}

const TreeContext = createContext<TreeContextValue>({
	indent: "var(--spacing-tree-indent)",
	toggleIconType: "chevron",
});

interface TreeProps extends HTMLAttributes<HTMLDivElement> {
	indent?: TreeIndent;
	tree?: TreeContainerInstance;
	toggleIconType?: ToggleIconType;
}

function Tree({
	indent = "var(--spacing-tree-indent)",
	tree,
	className,
	style,
	toggleIconType = "chevron",
	...props
}: TreeProps) {
	const containerProps = tree?.getContainerProps(props["aria-label"]) ?? {};
	return (
		<TreeContext.Provider value={{ indent, tree, toggleIconType }}>
			<div
				data-slot="tree"
				{...mergeProps<"div">(containerProps, props, {
					className: cn("flex min-w-0 flex-col", className),
					style: {
						"--tree-indent":
							typeof indent === "number" ? `${indent}px` : indent,
						...style,
					} as CSSProperties,
				})}
			/>
		</TreeContext.Provider>
	);
}

interface TreeItemProps<T = unknown>
	extends useRender.ComponentProps<"button"> {
	item: ItemInstance<T>;
	indent?: TreeIndent;
}

function TreeItem<T>({
	item,
	indent: itemIndent,
	className,
	style,
	render,
	ref,
	children,
	...props
}: TreeItemProps<T>) {
	const parentContext = useContext(TreeContext);
	const indent = itemIndent ?? parentContext.indent;
	const level = item.getItemMeta().level;
	const { ref: itemRef, ...itemProps } = item.getProps();
	const defaultProps = {
		type: render ? undefined : ("button" as const),
		"data-slot": "tree-item",
		"data-level": level,
		"data-focus": item.isFocused(),
		"data-folder": item.isFolder(),
		"data-selected": item.isSelected?.() ?? false,
		"data-drag-target": item.isDragTarget?.() ?? false,
		"data-search-match": item.isMatchingSearch?.() ?? false,
		className: cn(
			"group/tree-item relative min-w-0 select-none ps-(--tree-padding) text-start outline-hidden data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		),
		style: {
			"--tree-indent": typeof indent === "number" ? `${indent}px` : indent,
			"--tree-padding": `calc(${level} * var(--tree-indent))`,
			...style,
		} as CSSProperties,
	};
	const element = useRender({
		defaultTagName: "button",
		render,
		ref: [itemRef, ref],
		props: mergeProps<"button">(defaultProps, itemProps, {
			...props,
			children,
		}),
	});

	return (
		<TreeContext.Provider value={{ ...parentContext, currentItem: item }}>
			{element}
		</TreeContext.Provider>
	);
}

interface TreeItemLabelProps extends HTMLAttributes<HTMLSpanElement> {
	item?: TreeLabelItem;
}

function TreeItemLabel({
	item: propItem,
	children,
	className,
	...props
}: TreeItemLabelProps) {
	const { currentItem, toggleIconType } = useContext(TreeContext);
	const item = propItem ?? currentItem;
	if (!item) return null;
	const ToggleIcon =
		toggleIconType === "plus-minus"
			? item.isExpanded()
				? MinusIcon
				: PlusIcon
			: ChevronDownIcon;

	return (
		<span
			data-slot="tree-item-label"
			className={cn(
				"flex h-control-md w-full min-w-0 items-center gap-1 rounded-md in-data-[drag-target=true]:bg-accent in-data-[search-match=true]:bg-accent in-data-[selected=true]:bg-accent px-2 font-normal in-data-[selected=true]:text-accent-foreground text-control in-focus-visible:ring-2 in-focus-visible:ring-ring/50 transition-colors hover:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span
				data-slot="tree-item-toggle"
				aria-hidden="true"
				className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
			>
				{item.isFolder() && (
					<ToggleIcon
						className={cn(
							"size-4",
							toggleIconType === "chevron" &&
								!item.isExpanded() &&
								"-rotate-90",
						)}
					/>
				)}
			</span>
			{children ?? item.getItemName()}
		</span>
	);
}

function TreeDragLine({
	className,
	style,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	const { tree } = useContext(TreeContext);
	if (!tree?.getDragLineStyle) return null;
	return (
		<div
			data-slot="tree-drag-line"
			style={{ ...tree.getDragLineStyle(), ...style }}
			className={cn(
				"pointer-events-none absolute z-30 -mt-px h-0.5 bg-primary before:absolute before:-top-0.5 before:left-0 before:size-2 before:rounded-full before:border-2 before:border-primary before:bg-background",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Tree,
	TreeDragLine,
	TreeItem,
	TreeItemLabel,
	type TreeItemLabelProps,
	type TreeItemProps,
	type TreeProps,
};
