/**
 * @file 登录视图访问桌面连接设置的窄接口。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：在同一 CSR 中区分普通网页与 Electron preload 提供的能力。
 * 被调用：登录服务器设置；调用：desktop-bridge 的纯类型契约。
 * 预期结果：Web 不展示桌面设置，React 不引入 Electron/Node 或持有认证凭据。
 */
import type { DesktopBridge } from "@leonwillow-electron/desktop-bridge";

declare global {
	interface Window {
		aideskDesktop?: DesktopBridge;
	}
}

/** 仅检测 preload 暴露的能力，不依据可伪装的 User-Agent 判断桌面环境。 */
export function getDesktopBridge(): DesktopBridge | undefined {
	return typeof window === "undefined" ? undefined : window.aideskDesktop;
}

/** IPC 仅允许登录页保存；直接重载当前文档，清理旧路由资源与表单。 */
export function restartDesktopLogin() {
	window.location.reload();
}
