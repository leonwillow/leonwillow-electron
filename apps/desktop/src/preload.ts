/**
 * @file 桌面配置的最小 contextBridge。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：隔离 renderer 与 Electron IPC，不暴露通用调用或文件访问。
 * 被调用：BrowserWindow preload；调用：electron、desktop-bridge 类型。
 * 预期结果：共用 React 登录页通过三个明确的方法查看、测试及保存服务器配置。
 */
import type { DesktopBridge } from "@leonwillow-electron/desktop-bridge";
import { contextBridge, ipcRenderer } from "electron";

const bridge: DesktopBridge = {
	getConnection: () => ipcRenderer.invoke("desktop:connection:get"),
	saveConnection: (input) =>
		ipcRenderer.invoke("desktop:connection:save", input),
	testConnection: (input) =>
		ipcRenderer.invoke("desktop:connection:test", input),
};
contextBridge.exposeInMainWorld("aideskDesktop", Object.freeze(bridge));
