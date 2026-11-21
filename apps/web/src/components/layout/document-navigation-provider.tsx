/**
 * @file 文书类型菜单的导航上下文和共享目录/模板状态。
 * 创建时间：2026-10-13；修改时间：2026-11-21。
 * 版本作用：按需激活并统一持有文书目录（catalog）与模板定义（types），消除路由 loader 与二级菜单的重复请求。
 * 被调用：WorkspaceLayout、文书菜单内容与 DocumentsView。
 * 调用：WorkspaceNavigationProvider、Eden；预期结果：悬停或进入文书页仅请求一次，旧响应不覆盖刷新后的目录。
 */
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type DocumentCatalogType,
	type DocumentType,
	documentError,
	listDocumentCatalog,
	listDocumentTypes,
} from "@/lib/documents";
import {
	useWorkspaceMenuActivated,
	useWorkspaceMenuSection,
} from "./workspace-navigation-provider";

type DocumentNavigation = ReturnType<typeof useWorkspaceMenuSection> & {
	catalog: DocumentCatalogType[] | null;
	types: DocumentType[];
	loading: boolean;
	error: string;
	selection: number;
	refreshCatalog: () => Promise<void>;
	selectType: () => void;
};

const DocumentNavigationContext = createContext<DocumentNavigation | null>(
	null,
);

export function DocumentNavigationProvider({
	enabled,
	children,
}: {
	enabled: boolean;
	children: ReactNode;
}) {
	const menu = useWorkspaceMenuSection("documents");
	const activated = useWorkspaceMenuActivated("documents", enabled);
	const [catalog, updateCatalog] = useState<DocumentCatalogType[] | null>(null);
	const [types, updateTypes] = useState<DocumentType[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [selection, setSelection] = useState(0);
	const generation = useRef(0);

	const refreshCatalog = useCallback(async () => {
		const request = ++generation.current;
		setLoading(true);
		setError("");
		try {
			const [nextTypes, nextCatalog] = await Promise.all([
				listDocumentTypes(),
				listDocumentCatalog(),
			]);
			if (generation.current === request) {
				updateTypes(nextTypes);
				updateCatalog(nextCatalog);
			}
		} catch (cause) {
			if (generation.current === request) setError(documentError(cause));
		} finally {
			if (generation.current === request) setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (activated) void refreshCatalog();
	}, [activated, refreshCatalog]);

	useEffect(
		() => () => {
			generation.current += 1;
		},
		[],
	);

	const dismiss = menu.dismiss;
	const selectType = useCallback(() => {
		setSelection((value) => value + 1);
		dismiss();
	}, [dismiss]);

	const value = useMemo(
		() => ({
			...menu,
			catalog,
			types,
			loading,
			error,
			selection,
			refreshCatalog,
			selectType,
		}),
		[
			menu,
			catalog,
			types,
			loading,
			error,
			selection,
			refreshCatalog,
			selectType,
		],
	);

	return (
		<DocumentNavigationContext value={value}>
			{children}
		</DocumentNavigationContext>
	);
}

export function useDocumentNavigation() {
	const context = useContext(DocumentNavigationContext);
	if (!context) throw new Error("文书类型菜单必须放在工作台布局中。");
	return context;
}
