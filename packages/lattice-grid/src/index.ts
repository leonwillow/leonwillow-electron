/**
 * @file 可复用 Lattice Grid 工作区包的公开出口。
 * 创建时间：2026-11-05；修改时间：2026-11-06。
 * 版本作用：提供 React 表格、泛型列与数据事务，业务数据和持久化由调用方拥有。
 * 被调用：业务页面；调用：React 适配层与纯 TypeScript 内核。
 */

export type { InsertRowsRequest } from "./cell-context-menu";
export * from "./core/index";
export { DataGrid, type DataGridProps } from "./data-grid";
export type {
	CellContext,
	EditorContext,
	ViewOptions,
} from "./view-controller";
