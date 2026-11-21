/**
 * @file 工作台二级菜单的唯一挂载点与业务内容组合。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：按模块授权与首次激活惰性挂载菜单宿主，切换模块不叠加菜单框且保留已激活业务弹窗。
 * 被调用：WorkspaceLayout；调用：业务与管理菜单 Hook、WorkspaceMenu、共享导航上下文。
 * 功能与预期结果：未激活或无权限的模块不挂载树状态与全局事件监听；业务弹窗独立于浮层显隐。
 */
import { useEffect, useState } from "react";
import type { WorkspaceMenuId } from "@/lib/workspace-menu-state";
import { useAdminMenu } from "./use-admin-menu";
import { useCalculatorMenu } from "./use-calculator-menu";
import { useDocumentTypeMenu } from "./use-document-type-menu";
import { useFundsCaseMenu } from "./use-funds-case-menu";
import { useInquiryCaseMenu } from "./use-inquiry-case-menu";
import type { WorkspaceMenuNavigation } from "./use-workspace-menu";
import WorkspaceMenu, { type WorkspaceMenuContent } from "./workspace-menu";
import { useWorkspaceNavigation } from "./workspace-navigation-provider";

function SecondaryMenuSlot({
	active,
	navigation,
	content,
}: {
	active: boolean;
	navigation: WorkspaceMenuNavigation;
	content: WorkspaceMenuContent;
}) {
	return (
		<>
			{content.dialogs}
			{active && <WorkspaceMenu {...content} navigation={navigation} />}
		</>
	);
}

function FundsSecondaryMenuHost({
	active,
	navigation,
}: {
	active: boolean;
	navigation: WorkspaceMenuNavigation;
}) {
	return (
		<SecondaryMenuSlot
			active={active}
			navigation={navigation}
			content={useFundsCaseMenu()}
		/>
	);
}

function DocumentsSecondaryMenuHost({
	active,
	navigation,
}: {
	active: boolean;
	navigation: WorkspaceMenuNavigation;
}) {
	return (
		<SecondaryMenuSlot
			active={active}
			navigation={navigation}
			content={useDocumentTypeMenu()}
		/>
	);
}

function InquiriesSecondaryMenuHost({
	active,
	navigation,
}: {
	active: boolean;
	navigation: WorkspaceMenuNavigation;
}) {
	return (
		<SecondaryMenuSlot
			active={active}
			navigation={navigation}
			content={useInquiryCaseMenu()}
		/>
	);
}

function CalculatorsSecondaryMenuHost({
	active,
	navigation,
}: {
	active: boolean;
	navigation: WorkspaceMenuNavigation;
}) {
	return (
		<SecondaryMenuSlot
			active={active}
			navigation={navigation}
			content={useCalculatorMenu()}
		/>
	);
}

function AdminSecondaryMenuHost({
	active,
	navigation,
}: {
	active: boolean;
	navigation: WorkspaceMenuNavigation;
}) {
	return (
		<SecondaryMenuSlot
			active={active}
			navigation={navigation}
			content={useAdminMenu()}
		/>
	);
}

export default function WorkspaceSecondaryMenu({
	enabledMenus,
}: {
	enabledMenus: readonly WorkspaceMenuId[];
}) {
	const navigation = useWorkspaceNavigation();
	const activeMenu = navigation.activeMenu;
	const [mountedMenus, setMountedMenus] = useState<
		ReadonlySet<WorkspaceMenuId>
	>(() => (activeMenu ? new Set([activeMenu]) : new Set()));
	useEffect(() => {
		if (!activeMenu) return;
		setMountedMenus((current) => {
			if (current.has(activeMenu)) return current;
			const next = new Set(current);
			next.add(activeMenu);
			return next;
		});
	}, [activeMenu]);
	const shouldMount = (id: WorkspaceMenuId) =>
		enabledMenus.includes(id) && (activeMenu === id || mountedMenus.has(id));
	return (
		<>
			{shouldMount("funds") && (
				<FundsSecondaryMenuHost
					active={activeMenu === "funds"}
					navigation={navigation}
				/>
			)}
			{shouldMount("documents") && (
				<DocumentsSecondaryMenuHost
					active={activeMenu === "documents"}
					navigation={navigation}
				/>
			)}
			{shouldMount("inquiries") && (
				<InquiriesSecondaryMenuHost
					active={activeMenu === "inquiries"}
					navigation={navigation}
				/>
			)}
			{shouldMount("calculators") && (
				<CalculatorsSecondaryMenuHost
					active={activeMenu === "calculators"}
					navigation={navigation}
				/>
			)}
			{shouldMount("admin") && (
				<AdminSecondaryMenuHost
					active={activeMenu === "admin"}
					navigation={navigation}
				/>
			)}
		</>
	);
}
