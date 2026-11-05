/**
 * @file 工作台单个二级菜单框的状态转换及固定偏好。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：模块只决定当前内容，固定和展开状态归整个菜单框所有。
 * 被调用：use-workspace-menu、workspace-menu-state.test；调用：浏览器偏好存储。
 * 功能与预期结果：固定时只响应显式切换，未固定时允许悬停预览；统一偏好兼容旧存储及写入失败。
 */
export const workspaceMenuIds = ["funds", "documents", "inquiries"] as const;
export type WorkspaceMenuId = (typeof workspaceMenuIds)[number];

export function isWorkspaceMenuId(id: string): id is WorkspaceMenuId {
	return workspaceMenuIds.some((menuId) => menuId === id);
}

export function workspaceMenuForPath(pathname: string): WorkspaceMenuId | null {
	return (
		workspaceMenuIds.find(
			(id) => pathname === `/${id}` || pathname.startsWith(`/${id}/`),
		) ?? null
	);
}

export type WorkspaceMenuState = {
	activeMenu: WorkspaceMenuId | null;
	routeMenu: WorkspaceMenuId | null;
	open: boolean;
	pinned: boolean;
};

/** 路由仅选择菜单内容；临时浮窗始终从关闭开始，固定可见性由布局派生。 */
export function initialWorkspaceMenuState(
	routeMenu: WorkspaceMenuId | null,
	pinned: boolean,
): WorkspaceMenuState {
	return { activeMenu: routeMenu, routeMenu, open: false, pinned };
}

type WorkspaceMenuAction =
	| { type: "route"; menuId: WorkspaceMenuId | null }
	| { type: "preview"; menuId: WorkspaceMenuId | null }
	| { type: "show"; menuId: WorkspaceMenuId }
	| { type: "dismiss" }
	| { type: "pin"; pinned: boolean }
	| { type: "sync-pinned"; pinned: boolean };

export function workspaceMenuReducer(
	state: WorkspaceMenuState,
	action: WorkspaceMenuAction,
): WorkspaceMenuState {
	switch (action.type) {
		case "route":
			if (state.routeMenu === action.menuId) return state;
			return {
				...state,
				routeMenu: action.menuId,
				activeMenu: action.menuId,
				open: state.open && state.activeMenu === action.menuId,
			};
		case "show":
			return { ...state, activeMenu: action.menuId, open: true };
		case "preview":
			if (state.pinned) return state;
			return action.menuId
				? { ...state, activeMenu: action.menuId, open: true }
				: { ...state, open: false };
		case "dismiss":
			return { ...state, open: false };
		case "pin":
			return { ...state, pinned: action.pinned, open: true };
		case "sync-pinned":
			return { ...state, pinned: action.pinned };
	}
}

export const workspaceMenuStorageKey = (userId: string) =>
	`workspace-menu:v1:${userId}`;

const legacyPrefixes = [
	"funds-case-menu",
	"document-type-menu",
	"inquiry-case-menu",
];
type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 新值优先；首次升级时任一旧菜单已固定则保留固定，损坏/不可读的存储回退为未固定。 */
export function readWorkspaceMenuPinned(
	userId: string,
	storage?: PreferenceStorage,
): boolean {
	try {
		const target = storage ?? localStorage;
		const current = target.getItem(workspaceMenuStorageKey(userId));
		if (current !== null) return current === "true";
		return legacyPrefixes.some(
			(prefix) => target.getItem(`${prefix}:v1:${userId}`) === "true",
		);
	} catch {
		return false;
	}
}

/** 仅在统一偏好成功写入后清理同一用户的旧键；失败时保留旧值供下次恢复。 */
export function writeWorkspaceMenuPinned(
	userId: string,
	pinned: boolean,
	storage?: PreferenceStorage,
): void {
	try {
		const target = storage ?? localStorage;
		target.setItem(workspaceMenuStorageKey(userId), String(pinned));
		for (const prefix of legacyPrefixes)
			target.removeItem(`${prefix}:v1:${userId}`);
	} catch {
		// 浏览器禁用存储时，React 中的统一状态仍可正常使用。
	}
}
