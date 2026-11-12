/**
 * @file 桌面连接配置的纯数据契约与地址校验。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：Web、preload 和主进程共用契约，不引入 Electron 或 Node 运行时。
 * 调用：登录服务器设置、桌面 IPC 与配置存储；预期：配置使用相同规则且不包含凭据。
 */
export const DESKTOP_ORIGIN = "aidesk://app";

export type ConnectionInput = { address: string; port: string };
export type ConnectionStatus = {
	defaultUrl: string;
	customUrl: string | null;
	effectiveUrl: string;
	warning?: string;
};
export type ConnectionTestResult = { ok: boolean; message: string };
export type DesktopBridge = {
	getConnection(): Promise<ConnectionStatus>;
	saveConnection(input: ConnectionInput | null): Promise<ConnectionStatus>;
	testConnection(input: ConnectionInput | null): Promise<ConnectionTestResult>;
};

/**
 * 接受服务器地址与可选端口，返回唯一 HTTP(S) Origin；不接受路径或登录凭据。
 * 地址没有协议时按 HTTP 处理；端口空时沿用地址内端口或协议默认值。
 * IPC 同样调用此函数校验不可信输入；失败抛出可展示的中文错误，不回显输入内容。
 */
export function normalizeConnection(input: ConnectionInput): string {
	if (
		!input ||
		typeof input.address !== "string" ||
		typeof input.port !== "string"
	)
		throw new Error("服务器配置格式无效。");
	const address = input.address.trim();
	const port = input.port.trim();
	if (!address || /[\s\\]/.test(address))
		throw new Error("请输入有效的服务器地址。");
	let url: URL;
	try {
		url = new URL(address.includes("://") ? address : `http://${address}`);
	} catch {
		throw new Error("服务器地址无效，请填写域名或 IP 地址。");
	}
	if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
		throw new Error("服务器地址只支持 HTTP 或 HTTPS。");
	if (url.port === "0") throw new Error("端口必须是 1 至 65535 的整数。");
	if (url.username || url.password)
		throw new Error("服务器地址不能包含账号或密码。");
	if (url.pathname !== "/" || url.search || url.hash || /[?#]/.test(address))
		throw new Error("只需填写服务器地址，不要包含 /api、其他路径或查询参数。");
	if (port) {
		if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
			throw new Error("端口必须是 1 至 65535 的整数。");
		if (url.port && Number(url.port) !== Number(port))
			throw new Error("地址中的端口与端口输入框不一致，请只填写一个端口。");
		url.port = String(Number(port));
	}
	return url.origin;
}

/** 将已校验的 Origin 拆为编辑字段；标准 80/443 端口留空，由协议决定。 */
export function connectionInput(value: string): ConnectionInput {
	const url = new URL(normalizeConnection({ address: value, port: "" }));
	return { address: `${url.protocol}//${url.hostname}`, port: url.port };
}
