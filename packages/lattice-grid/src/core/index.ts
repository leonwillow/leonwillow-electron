/**
 * @file Lattice Grid index：泛型表格数据与事务内核。
 * 创建时间：2026-11-05；修改时间：2026-11-05。
 * 版本作用：适配 MIT Lattice Grid 0.1.0-beta.1，保留原始行标识、不可变事务与数据隔离。
 * 被调用：独立表格包的 React 视图；调用：包内核心模块，不依赖业务、数据库或路由。
 * 预期结果：多个表格实例独立工作，外部数据和提交由调用页面管理。
 */

export * from "./data";
export { getCellValue as valueOf } from "./data";
export * from "./messages";
export * from "./store";
export * from "./types";
