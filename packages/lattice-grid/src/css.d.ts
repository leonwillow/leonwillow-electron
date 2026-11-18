/**
 * @file 网格包内样式文件的 TypeScript 模块声明。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：供 tsc 校验 DataGrid 的按需 CSS 副作用导入，运行时由 Vite 处理。
 * 被调用：packages/lattice-grid/tsconfig.json。
 * 调用：无模块依赖。
 * 功能：声明 *.css 模块类型。
 * 预期结果：保留严格的副作用导入检查，同时允许包内同目录加载 lattice-grid.css。
 */
declare module "*.css" {}
