/**
 * @file 工作台二级菜单的唯一挂载点与业务内容组合。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：当前模块选择菜单内容，统一框架和导航状态保持同一实例。
 * 被调用：WorkspaceLayout；调用：业务菜单 Hook、WorkspaceMenu、共享导航上下文。
 * 功能与预期结果：切换模块不叠加菜单框，不丢失业务草稿；业务弹窗独立于浮层显隐。
 */
import type { WorkspaceMenuId } from "@/lib/workspace-menu-state";
import useDocumentTypeMenu from "./document-type-sidebar";
import useFundsCaseMenu from "./funds-case-sidebar";
import useInquiryCaseMenu from "./inquiry-case-sidebar";
import WorkspaceMenu from "./workspace-menu";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

export default function WorkspaceSecondaryMenu({
	enabledMenus,
}: {
	enabledMenus: readonly WorkspaceMenuId[];
}) {
	const navigation = useWorkspaceNavigation();
	const funds = useFundsCaseMenu(enabledMenus.includes("funds"));
	const documents = useDocumentTypeMenu();
	const inquiries = useInquiryCaseMenu();
	const content = navigation.activeMenu
		? { funds, documents, inquiries }[navigation.activeMenu]
		: null;
	return (
		<>
			{enabledMenus.includes("funds") && funds.dialogs}
			{enabledMenus.includes("inquiries") && inquiries.dialogs}
			{content && <WorkspaceMenu {...content} navigation={navigation} />}
		</>
	);
}
