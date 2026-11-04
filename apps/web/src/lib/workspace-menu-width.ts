/**
 * @file 工作台共享二级菜单宽度偏好的读写与校验。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：按用户保存 rem 宽度，独立于固定开关及具体业务菜单。
 * 被调用：use-workspace-menu-width；调用：浏览器偏好存储。
 * 预期结果：刷新后恢复同一宽度，损坏或不可读的偏好回退共享样式默认值。
 */
type WidthStorage = Pick<Storage, "getItem" | "setItem">;

export const workspaceMenuWidthStorageKey = (userId: string) =>
	`workspace-menu-width:v1:${userId}`;

/** 只检查可表达的正数；实际布局的最小/最大宽度仍由共享样式和面板约束决定。 */
export function isWorkspaceMenuWidth(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value > 0 &&
		value <= Number.MAX_SAFE_INTEGER
	);
}

/** userId 仅选择该用户的共享偏好；缺失、损坏或存储被禁用时返回 null，交由样式提供默认宽度。 */
export function readWorkspaceMenuWidth(
	userId: string,
	storage?: WidthStorage,
): number | null {
	try {
		const target = storage ?? localStorage;
		const current = target.getItem(workspaceMenuWidthStorageKey(userId));
		if (current === null) return null;
		const value: unknown = JSON.parse(current);
		return isWorkspaceMenuWidth(value) ? value : null;
	} catch {
		return null;
	}
}

/** 仅提交有效的 rem 数值；写入失败不抛错，调用方保留已经更新的会话内宽度。 */
export function writeWorkspaceMenuWidth(
	userId: string,
	widthRem: number,
	storage?: WidthStorage,
): void {
	if (!isWorkspaceMenuWidth(widthRem)) return;
	try {
		const target = storage ?? localStorage;
		target.setItem(
			workspaceMenuWidthStorageKey(userId),
			JSON.stringify(widthRem),
		);
	} catch {
		// 偏好不可持久化时，本次拖拽仍由 React 状态呈现。
	}
}
