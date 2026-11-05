/**
 * @file 笔录案件二级菜单的导航上下文。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：持有目录查询、案件资源及展开集合，菜单框的固定、展开及焦点由工作台统一提供。
 * 被调用：WorkspaceLayout、笔录视图和菜单内容。
 * 调用：WorkspaceNavigationProvider、笔录资源 Hook；预期结果：保存/归档后目录及时刷新。
 */
import { useSearch } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { listInquiryCases } from "@/lib/inquiries";
import { useInquiryResource } from "@/views/inquiries/use-inquiry-resource";
import { InquiryEditorActionsProvider } from "./inquiry-editor-actions";
import { useWorkspaceMenuSection } from "./workspace-navigation-provider";

type InquiryNavigation = ReturnType<typeof useWorkspaceMenuSection> & {
	query: string;
	archived: boolean;
	setQuery: (value: string) => void;
	setArchived: (value: boolean) => void;
	resetFilters: () => void;
	expandedCases: ReadonlySet<string>;
	setCaseExpanded: (id: string, expanded: boolean) => void;
	setExpandedCases: (ids: string[]) => void;
	cases: ReturnType<
		typeof useInquiryResource<Awaited<ReturnType<typeof listInquiryCases>>>
	>;
};
const Context = createContext<InquiryNavigation | null>(null);
export function InquiryNavigationProvider({
	enabled,
	children,
}: {
	enabled: boolean;
	children: ReactNode;
}) {
	const menu = useWorkspaceMenuSection("inquiries");
	const [query, setQuery] = useState("");
	const [archived, setArchived] = useState(false);
	const searchTerm = query.trim();
	const loadCases = useCallback(
		() =>
			listInquiryCases({
				q: searchTerm,
			}),
		[searchTerm],
	);
	const cases = useInquiryResource(enabled ? loadCases : null);
	const resetFilters = useCallback(() => {
		setQuery("");
		setArchived(false);
	}, []);
	const { inquiryCaseId } = useSearch({ strict: false });
	const [expandedCases, updateExpandedCases] = useState<Set<string>>(
		() => new Set(),
	);
	const setExpandedCases = useCallback((ids: string[]) => {
		updateExpandedCases((current) => {
			const next = new Set(ids);
			return current.size === next.size &&
				[...current].every((id) => next.has(id))
				? current
				: next;
		});
	}, []);
	const setCaseExpanded = useCallback((id: string, expanded: boolean) => {
		updateExpandedCases((current) => {
			if (current.has(id) === expanded) return current;
			const next = new Set(current);
			if (expanded) next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);
	useEffect(() => {
		if (inquiryCaseId) setCaseExpanded(inquiryCaseId, true);
	}, [inquiryCaseId, setCaseExpanded]);
	return (
		<Context
			value={{
				...menu,
				cases,
				query,
				archived,
				setQuery,
				setArchived,
				resetFilters,
				expandedCases,
				setCaseExpanded,
				setExpandedCases,
			}}
		>
			<InquiryEditorActionsProvider>{children}</InquiryEditorActionsProvider>
		</Context>
	);
}
export function useInquiryNavigation() {
	const context = useContext(Context);
	if (!context) throw new Error("笔录案件菜单必须位于工作台布局中。");
	return context;
}
