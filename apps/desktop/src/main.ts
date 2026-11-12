/**
 * @file Electron 主进程与服务器配置的生命周期。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 版本作用：加载已打包的共用 Web 前端，不在客户端运行数据库或业务服务。
 * 被调用：桌面 start/打包入口；调用：Electron、连接存储和协议代理。
 * 预期结果：登录页可配置服务器，切换服务器隔离会话，默认地址由构建注入。
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type ConnectionInput,
	type ConnectionTestResult,
	DESKTOP_ORIGIN,
	normalizeConnection,
} from "@leonwillow-electron/desktop-bridge";
import {
	app,
	BrowserWindow,
	dialog,
	type IpcMainInvokeEvent,
	ipcMain,
	protocol,
	session,
} from "electron";
import { createConnectionStore } from "./connection-store";
import { createProtocolHandler } from "./protocol-handler";
import { isAppUrl, networkPartition } from "./request-policy";
import { sessionRequest } from "./session-request";

protocol.registerSchemesAsPrivileged([
	{
		scheme: "aidesk",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true,
			stream: true,
		},
	},
]);

const applicationRoot = app.getAppPath();
let window: BrowserWindow | null = null;

/** IPC只允许应用主窗口的顶层本地页面；服务器变更仅从登录页发起。 */
function assertSender(event: IpcMainInvokeEvent, loginOnly = false) {
	if (
		!window ||
		event.sender !== window.webContents ||
		event.senderFrame !== window.webContents.mainFrame ||
		!isAppUrl(event.senderFrame.url, loginOnly)
	)
		throw new Error("此页面不能访问服务器设置。");
}

async function start() {
	const config: unknown = JSON.parse(
		await readFile(join(applicationRoot, "dist/config.json"), "utf8"),
	);
	if (
		!config ||
		typeof config !== "object" ||
		!("defaultUrl" in config) ||
		typeof config.defaultUrl !== "string"
	)
		throw new Error("桌面构建缺少默认服务器配置。");
	const store = await createConnectionStore(
		join(app.getPath("userData"), "server-connection.json"),
		config.defaultUrl,
	);
	const networkSession = (url: string) =>
		session.fromPartition(networkPartition(url));
	const handler = createProtocolHandler({
		rendererRoot: join(applicationRoot, "dist/renderer"),
		getTarget: () => {
			const url = store.status().effectiveUrl;
			const network = networkSession(url);
			return {
				url,
				fetch: (address, options) => sessionRequest(network, address, options),
			};
		},
	});
	const rendererSession = session.fromPartition("persist:aidesk-renderer");
	rendererSession.setPermissionRequestHandler(
		(contents, permission, callback, details) =>
			callback(
				permission === "fullscreen" &&
					contents === window?.webContents &&
					details.isMainFrame &&
					isAppUrl(details.requestingUrl),
			),
	);
	rendererSession.setPermissionCheckHandler(
		(contents, permission, origin, details) =>
			permission === "fullscreen" &&
			contents === window?.webContents &&
			details.isMainFrame &&
			isAppUrl(origin) &&
			isAppUrl(details.requestingUrl ?? ""),
	);
	rendererSession.protocol.handle("aidesk", handler.handle);
	ipcMain.handle("desktop:connection:get", (event) => {
		assertSender(event);
		return store.status();
	});
	ipcMain.handle(
		"desktop:connection:save",
		async (event, input: ConnectionInput | null) => {
			assertSender(event, true);
			try {
				const result = await store.save(input);
				handler.cancel();
				return result;
			} catch (error) {
				if (error instanceof Error && !("code" in error)) throw error;
				throw new Error("服务器设置未保存，请检查应用数据目录是否可写。");
			}
		},
	);
	ipcMain.handle(
		"desktop:connection:test",
		async (
			event,
			input: ConnectionInput | null,
		): Promise<ConnectionTestResult> => {
			assertSender(event, true);
			const url =
				input === null ? store.status().defaultUrl : normalizeConnection(input);
			try {
				const response = await session.defaultSession.fetch(
					`${url}/api/health`,
					{
						headers: { origin: DESKTOP_ORIGIN, accept: "application/json" },
						credentials: "omit",
						redirect: "error",
						signal: AbortSignal.timeout(8_000),
					},
				);
				const body = await response.json();
				return response.ok &&
					body?.status === "ok" &&
					body?.service === "leonwillow-electron"
					? { ok: true, message: "服务器连接成功。" }
					: {
							ok: false,
							message: "该地址未返回本项目的服务信息，请确认地址和端口。",
						};
			} catch {
				return {
					ok: false,
					message: "无法连接服务器，请检查地址、端口、网络或 HTTPS 证书。",
				};
			}
		},
	);
	const createWindow = () => {
		window = new BrowserWindow({
			width: 1360,
			height: 900,
			minWidth: 480,
			minHeight: 560,
			title: "AIDesk",
			show: false,
			webPreferences: {
				preload: join(applicationRoot, "dist/preload.cjs"),
				session: rendererSession,
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: true,
				webSecurity: true,
				webviewTag: false,
			},
		});
		// 仅记录生命周期错误码，不写页面参数、接口正文或登录凭据。
		window.webContents.on(
			"did-fail-load",
			(_event, code, _description, _url, mainFrame) => {
				if (mainFrame && code !== -3)
					console.error(`[desktop] 页面加载失败，错误码 ${code}。`);
			},
		);
		window.webContents.on("render-process-gone", (_event, details) => {
			console.error(
				`[desktop] 页面进程退出：${details.reason} (${details.exitCode})。`,
			);
		});
		window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
		window.webContents.on("will-navigate", (event, url) => {
			if (!isAppUrl(url)) event.preventDefault();
		});
		window.webContents.on("will-redirect", (event, url) => {
			if (!isAppUrl(url)) event.preventDefault();
		});
		window.webContents.on("will-frame-navigate", (event) => {
			if (
				!isAppUrl(event.url) &&
				!["about:blank", "about:srcdoc"].includes(event.url)
			)
				event.preventDefault();
		});
		window.webContents.on("will-attach-webview", (event) =>
			event.preventDefault(),
		);
		window.on("ready-to-show", () => window?.show());
		window.on("closed", () => {
			handler.cancel();
			window = null;
		});
		void window.loadURL(`${DESKTOP_ORIGIN}/login`).catch(() => {
			console.error("[desktop] 登录页面未能加载。");
		});
	};
	createWindow();
	app.on("activate", () => {
		if (!window) createWindow();
	});
	app.on("before-quit", () => handler.cancel());
}

// 单实例避免同一配置文件并行写入；第二次启动只唤醒当前窗口。
if (!app.requestSingleInstanceLock()) app.quit();
else {
	app.on("second-instance", () => {
		window?.show();
		window?.focus();
	});
	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});
	void app
		.whenReady()
		.then(start)
		.catch(() => {
			dialog.showErrorBox(
				"AIDesk 无法启动",
				"桌面文件或配置无法读取，请重新构建或安装应用。",
			);
			app.quit();
		});
}
