/**
 * @file 工作台单个二级菜单框的导航上下文。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：在布局中唯一创建菜单状态，模块适配只绑定内容 ID，不创建独立状态。
 * 被调用：WorkspaceLayout、AppSidebar、业务导航与 WorkspaceSecondaryMenu。
 * 调用：useWorkspaceMenu；预期结果：任意模块固定/取消固定后，整个菜单框同步生效。
 */
import { createContext, type ReactNode, useContext } from "react";
import type { WorkspaceMenuId } from "@/lib/workspace-menu-state";
import {
	useWorkspaceMenu,
	type WorkspaceMenuNavigation,
} from "./use-workspace-menu";

const Context = createContext<WorkspaceMenuNavigation | null>(null);

export function WorkspaceNavigationProvider({
	userId,
	enabledMenus,
	children,
}: {
	userId: string;
	enabledMenus: readonly WorkspaceMenuId[];
	children: ReactNode;
}) {
	const navigation = useWorkspaceMenu({ userId, enabledMenus });
	return <Context value={navigation}>{children}</Context>;
}

export function useWorkspaceNavigation() {
	const context = useContext(Context);
	if (!context) throw new Error("二级菜单必须放在工作台布局中。");
	return context;
}

/** 只绑定模块的打开/聚焦入口；固定偏好、DOM 引用、关闭行为仍来自同一个上下文。 */
export function useWorkspaceMenuSection(menuId: WorkspaceMenuId) {
	const navigation = useWorkspaceNavigation();
	return {
		...navigation,
		visible: navigation.visible && navigation.activeMenu === menuId,
		docked: navigation.docked && navigation.activeMenu === menuId,
		show: () => navigation.show(menuId),
		focusPanel: () => navigation.focusPanel(menuId),
	};
}
