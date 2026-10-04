/**
 * @file 应用品牌与工作台显示名称。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout、views/register、views/login。
 * 调用：无模块依赖。
 * 功能：集中提供界面展示用的固定名称。
 * 预期结果：登录、注册、Logo 与个人菜单使用一致文案。
 */
export const appConfig = {
	name: "AIDesk",
	workspaceName: "工作台",
} as const;
