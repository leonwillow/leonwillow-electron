/**
 * @file 共享 UI 包局部 CSS Module 的 TypeScript 声明。
 * 创建及修改时间：2026-11-06。
 * 版本作用：支持 Arc UI 官方组件的 *.module.css 导入；不声明全局样式为模块。
 * 预期结果：类型检查识别组件类名映射，Vite 继续负责实际样式加载。
 */
declare module "*.module.css" {
	const classes: { readonly [key: string]: string };
	export default classes;
}
