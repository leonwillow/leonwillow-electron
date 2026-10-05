/**
 * @file 界面使用的账号请求与错误边界。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：Web 与未来桌面 renderer 共用的 CSR 实现。
 * 被调用：components/layout/profile-menu.tsx、views/login/login-form.tsx、routes/_workspace/route.tsx。
 * 调用：./api。
 * 功能：封装登录、会话读取、退出及中文错误转换。
 * 预期结果：路由能区分未登录与服务故障，表单无需处理底层响应结构。
 */
import { api } from "./api";

class AuthRequestError extends Error {}

function throwAuthRequestError(error: { value: unknown }): never {
	const value = error.value;
	const message =
		typeof value === "object" &&
		value !== null &&
		"message" in value &&
		typeof value.message === "string"
			? value.message
			: "暂时无法连接登录服务，请稍后再试。";
	throw new AuthRequestError(message);
}

/**
 * 仅向界面返回认证接口的公开消息；未知异常使用统一连接失败文案。
 * @param error 捕获到的异常，可能不是 Error。
 * @returns 可直接交给 toast 的中文文本。
 */
export const authErrorMessage = (error: unknown) =>
	error instanceof AuthRequestError
		? error.message
		: "暂时无法连接登录服务，请稍后再试。";

/**
 * GET /api/auth/session：通过 HttpOnly Cookie 恢复公开用户资料。
 * @returns 有效用户；仅 401 返回 null，让路由执行登录跳转。
 * @throws 服务或网络异常；不把故障伪装成未登录。
 */
export async function getSession() {
	const { data, error, status } = await api.api.auth.session.get();
	if (status === 401) return null;
	if (error) throwAuthRequestError(error);
	if (!data) throw new AuthRequestError("无法读取登录状态，请稍后再试。");
	return data.user;
}

/**
 * POST /api/auth/login：校验账号密码并由浏览器接收会话 Cookie。
 * @param values username 为账号，password 保持原样；rememberMe 控制持久 Cookie。
 * @returns 请求成功后完成，不在浏览器存储密码或 token。
 * @throws 认证错误；调用方通过 authErrorMessage 展示中文反馈。
 */
export async function login(values: {
	username: string;
	password: string;
	rememberMe: boolean;
}) {
	const { error } = await api.api.auth.login.post(values);
	if (error) throwAuthRequestError(error);
}

/**
 * POST /api/auth/logout：撤销服务端会话并让浏览器接收清除 Cookie 的响应。
 * @returns 服务端确认后完成；调用方再刷新路由并跳转到登录。
 * @throws 请求失败；不提前伪装成退出成功。
 */
export async function logout() {
	const { error } = await api.api.auth.logout.post();
	if (error) throwAuthRequestError(error);
}
