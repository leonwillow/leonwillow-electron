/**
 * @file 资金模块打开工作台二级菜单的适配入口。
 * 创建时间：2026-10-06；修改时间：2026-11-04。
 * 版本作用：只绑定资金菜单内容，不再创建上下文或持有固定/展开状态。
 * 被调用：资金视图与案件菜单；调用：WorkspaceNavigationProvider。
 * 功能与预期结果：资金模块使用工作台同一个菜单框与固定偏好。
 */
import { useWorkspaceMenuSection } from "./workspace-navigation-provider";

export function useFundsNavigation() {
	return useWorkspaceMenuSection("funds");
}
