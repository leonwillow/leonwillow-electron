# Electron 桌面适配

维护日期：2026-11-10。

## 架构与目录

`apps/desktop` 只负责桌面窗口、本地资源、连接配置及 API 转发。界面直接使用 `apps/web` 的 Vite 生产产物，继续运行同一份 React CSR、TanStack Router、Eden 和共享 UI；不复制登录、笔录、计算器或其他业务实现。后端仍是独立部署的 Bun/Elysia 服务，数据库继续由后端访问，不随桌面应用打包。

| 位置 | 职责 |
| --- | --- |
| `apps/desktop/src/main.ts` | 窗口、协议注册、IPC、服务器独立网络会话及退出清理 |
| `apps/desktop/src/preload.ts` | 通过 `contextBridge` 暴露三个连接设置方法，不暴露通用 IPC 或 Node API |
| `apps/desktop/src/connection-store.ts` | 主进程读取、校验、串行原子保存连接配置 |
| `apps/desktop/src/protocol-handler.ts`、`request-policy.ts` | 本地资源与 SPA 回退、请求来源校验、API 转发和响应流清理 |
| `apps/desktop/src/session-request.ts` | 使用 Chromium 原生网络请求维护后端 Cookie、二进制响应与取消生命周期 |
| `apps/desktop/build.ts`、`package.ts` | Bun 编译桌面入口、复制 Web 产物、本机平台打包 |
| `packages/desktop-bridge` | 无 Electron/Node 依赖的配置类型、地址校验及固定应用来源 |
| `apps/web/src/views/login/server-connection-settings.tsx` | 登录页服务器设置，复用 Dialog、Field、Input、Button 和 Sonner |
| `apps/web/src/lib/desktop.ts`、`api.ts` | preload 能力适配及桌面/网页共用的 Eden 入口 |

桌面前端从固定的 `aidesk://app/login` 加载本地文件。Eden 在桌面请求 `aidesk://app/api/*`，主进程将请求转给当前后端；普通开发网页继续使用同源代理，生产网页继续使用公开的 `VITE_SERVER_URL`。React 不直接导入 Electron，也不负责转发 Cookie。

## 默认地址与用户配置

构建时从 Web 的公开配置读取 `VITE_SERVER_URL`，缺省为 `http://localhost:3000`。读取优先级由低到高是 `.env.schema`、`.env`、`.env.local`、`.env.production`、`.env.production.local`，最后由构建进程中的同名环境变量覆盖。桌面只写入归一化后的公开地址到 `dist/config.json`，不复制数据库连接、认证密钥或其他环境变量。

首次启动没有自定义配置时，使用构建默认地址。登录页展示当前生效地址，并提供“服务器设置”：

- 地址接受 HTTP/HTTPS 域名或 IP；省略协议时按 HTTP 处理。端口选填，范围 1～65535；留空沿用地址中的端口，否则使用协议默认端口。
- 只填写服务器 Origin，例如 `https://api.example.com` 或 `http://192.168.1.20:3000`，不带 `/api`、其他路径、查询、片段或账号密码；地址内端口与单独端口不一致时拒绝保存。
- “测试连接”调用候选地址的 `/api/health`，核对本项目服务标识，不带登录凭据，不修改当前配置。测试超时为 8 秒；格式正确但暂时不可达的地址仍可保存。
- “恢复默认”先调整表单，点击“保存并应用”后才删除自定义覆盖；“取消”保留原连接。
- 保存成功后中止旧服务器进行中的请求，并整页回到 `/login`，清理旧页面、路由数据及表单。配置只允许从应用主窗口的登录页变更。

配置位于 Electron `app.getPath("userData")` 下的 `server-connection.json`，仅保存版本和自定义 URL，不保存账号或密码。先写临时文件、再原子替换；写入失败不切换生效地址。配置损坏时回到默认地址，并在登录页提示重新设置。

`localhost` 始终指运行桌面应用的设备。后端部署到其他机器后，用户应配置那台机器可访问的域名或 IP。服务端须提供根路径下的 `/api/*`；当前代理拒绝重定向，应填写直接可达的最终地址。

## 会话与请求边界

后端网络会话按归一化服务器 Origin 的 SHA-256 建立独立的持久 Chromium 分区。协议、主机或端口不同即是不同分区；服务器 A 的认证 Cookie 不会发送给服务器 B。切回 A 可以继续使用 A 尚未过期的会话，切换配置本身不等同于注销所有服务器。登录的“记住我”、服务端过期和主动退出仍按现有认证规则处理。

主进程只转发业务需要的请求头，固定设置 `Origin: aidesk://app`，不接受 renderer 提供的 Cookie、Host 或其他来源。`net.request` 的网络站点使用选定后端的 Origin，使现有 SameSite Cookie 按同站请求收发；HTTP Origin 仍为固定桌面来源，后端认证校验保持生效。Cookie 由服务器对应的 Chromium 网络会话维护，响应中的 `Set-Cookie` 不交给 renderer。API 响应按流返回，切换服务器、取消请求或退出应用时中止旧请求。

后端的来源解析器在开发与生产模式都精确接受 `aidesk://app`，CORS、应用写操作和 Better Auth 共用同一解析器。没有放开任意网站、`null` 来源或相似自定义协议地址，也不需要登记每个桌面用户的 IP。更换远程后端时，该部署必须包含这一桌面来源适配；网页来源规则继续独立生效，见 [后端认证](./auth-backend.md)。

窗口保持 `contextIsolation`、`sandbox`、`webSecurity`，关闭 `nodeIntegration` 和 WebView。IPC 验证应用窗口及顶层 frame；外部导航、新窗口和权限申请被拒绝，仅允许本地主窗口申请全屏以保留已有全屏按钮。本地页面的 CSP 将脚本、网络连接和资源范围限制到已有本地应用用途。桌面壳不提供通用 URL 代理或任意文件读取入口。

## 启动、构建与打包

以下命令在仓库根目录执行，依赖安装和构建脚本均使用 Bun：

```sh
bun install
bun run dev:server
bun run dev:desktop
```

`dev:desktop` 先执行 `build:desktop`，再启动 Electron；它加载已构建的本地 Web，不是 Vite 热更新窗口。修改前端或桌面源码后需重新构建并启动。已运行后端时无需重复启动 `dev:server`，使用远程后端时也不需要本机启动后端。

```sh
bun run build:desktop
bun run --cwd apps/desktop start
bun run package:desktop
```

`build:desktop` 通过 Turbo 先构建 Web，然后生成 `apps/desktop/dist/main.cjs`、`preload.cjs`、`config.json` 和 `renderer/`。`package:desktop` 再调用 Electron Packager，产物位于 `apps/desktop/dist/release/`，只装入桌面入口、Web 产物及公开配置。

当前打包脚本以运行机器的平台和架构生成应用目录，支持代码分支为 macOS/Windows/Linux 的 x64/arm64；这不是各平台均已验收的声明。当前未接入安装器、代码签名、公证或自动更新，跨平台发行需在目标平台继续验收。

## 验证与本机边界

纯配置及协议边界回归通过 `bun run test:desktop` 执行；真实 Electron 网络栈的独立验证入口为 `bun run --cwd apps/desktop test:electron`。仓库 lint、类型检查、生产构建及 UI/API 检查继续使用原命令。

2026-11-10 已完成后端来源与认证回归：17 项通过，包含生产/开发来源校验，以及隔离 PostgreSQL schema 中从 `aidesk://app` 登录、读取会话、拒绝伪似来源退出、正常退出后的会话失效。服务端类型检查通过。

2026-11-10 本机 macOS arm64 验收：配置与协议测试通过，真实 Electron 两进程测试验证了登录 Cookie、重启恢复、同主机不同端口的会话隔离、退出清除、重定向拒绝和二进制流取消。原生窗口验证地址/端口、无效端口提示、测试连接、取消不保存、配置重启回读、真实登录/退出、笔录及计算器导航、全屏与 Escape 退出；打包后的 `AIDesk.app` 可独立加载本地前端。

首次打包交互曾出现一次保存后同 URL 跳转空白，手动刷新恢复，后续同操作未复现。保存后的页面更新已改为完整文档刷新；重新打包后自定义地址保存及恢复默认均直接回到登录页，无需手动刷新。小窗口设置表单、Tab 与 Escape 验证通过。主进程记录主页面加载失败和渲染进程退出诊断，不记录接口参数或凭据。该验收不是 Windows/Linux 或长期稳定性的保证。

桌面验收使用临时随机数据库 schema 与合成账号，不修改现有用户密码或业务数据；完成后注销测试会话、恢复默认服务器并清理临时 schema。仓库 lint、类型检查、UI 测试、架构检查及生产构建通过。
