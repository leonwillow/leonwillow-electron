/**
 * @file 文书类型菜单的导航上下文和目录状态。
 * 创建时间：2026-10-13；修改时间：2026-11-04。
 * 版本作用：只持有文书目录及类型选择状态，菜单框状态统一由工作台提供。
 * 被调用：WorkspaceLayout、文书菜单内容与 DocumentsView。
 * 调用：WorkspaceNavigationProvider、Eden；预期结果：悬停无需跳转，旧响应不覆盖管理后目录。
 */
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type DocumentCatalogType,
	documentError,
	listDocumentCatalog,
} from "@/lib/documents";
import { useWorkspaceMenuSection } from "./workspace-navigation-provider";

type DocumentNavigation = ReturnType<typeof useWorkspaceMenuSection> & {
	catalog: DocumentCatalogType[] | null;
	loading: boolean;
	error: string;
	selection: number;
	setCatalog: (catalog: DocumentCatalogType[]) => void;
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
	const [catalog, updateCatalog] = useState<DocumentCatalogType[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [selection, setSelection] = useState(0);
	const generation = useRef(0);
	const setCatalog = useCallback((types: DocumentCatalogType[]) => {
		generation.current += 1;
		updateCatalog(types);
		setLoading(false);
		setError("");
	}, []);
	const refreshCatalog = useCallback(async () => {
		const request = ++generation.current;
		setLoading(true);
		setError("");
		try {
			const types = await listDocumentCatalog();
			if (generation.current === request) updateCatalog(types);
		} catch (cause) {
			if (generation.current === request) setError(documentError(cause));
		} finally {
			if (generation.current === request) setLoading(false);
		}
	}, []);
	useEffect(() => {
		if (enabled && menu.visible) void refreshCatalog();
	}, [enabled, menu.visible, refreshCatalog]);
	useEffect(
		() => () => {
			generation.current += 1;
		},
		[],
	);
	return (
		<DocumentNavigationContext
			value={{
				...menu,
				catalog,
				loading,
				error,
				selection,
				setCatalog,
				refreshCatalog,
				selectType: () => {
					setSelection((value) => value + 1);
					menu.dismiss();
				},
			}}
		>
			{children}
		</DocumentNavigationContext>
	);
}
export function useDocumentNavigation() {
	const context = useContext(DocumentNavigationContext);
	if (!context) throw new Error("文书类型菜单必须放在工作台布局中。");
	return context;
}
