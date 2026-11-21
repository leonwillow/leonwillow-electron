/**
 * @file 资金模块二级菜单的导航上下文与共享案件列表资源。
 * 创建时间：2026-10-06；修改时间：2026-11-21。
 * 版本作用：统一为资金二级菜单、资金分析页与案件管理页提供按需激活的案件目录，消除路由 loader 重复请求。
 * 被调用：WorkspaceLayout、资金视图与案件菜单；调用：WorkspaceNavigationProvider、useAsyncResource、listFundsCases。
 * 功能与预期结果：首次激活资金菜单或进入资金路由时加载一次案件列表，跨视图共享状态与手动刷新。
 */
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { listFundsCases } from "@/lib/funds";
import {
	useWorkspaceMenuActivated,
	useWorkspaceMenuSection,
} from "./workspace-navigation-provider";

type FundsNavigation = ReturnType<typeof useWorkspaceMenuSection> & {
	cases: ReturnType<
		typeof useAsyncResource<Awaited<ReturnType<typeof listFundsCases>>>
	>;
};

const FundsNavigationContext = createContext<FundsNavigation | null>(null);

export function FundsNavigationProvider({
	enabled,
	children,
}: {
	enabled: boolean;
	children: ReactNode;
}) {
	const menu = useWorkspaceMenuSection("funds");
	const activated = useWorkspaceMenuActivated("funds", enabled);
	const cases = useAsyncResource(activated ? listFundsCases : null, {
		keepPreviousOnReload: true,
	});
	const value = useMemo(() => ({ ...menu, cases }), [menu, cases]);
	return (
		<FundsNavigationContext value={value}>{children}</FundsNavigationContext>
	);
}

export function useFundsNavigation() {
	const context = useContext(FundsNavigationContext);
	if (!context) throw new Error("资金案件菜单必须位于工作台布局中。");
	return context;
}
