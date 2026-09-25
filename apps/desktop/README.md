# Electron 桌面端

包名：`@platform/desktop`。负责桌面宿主能力；业务页面来自 `apps/web` 的 Nuxt SPA。

| 目录 | 内容 |
| --- | --- |
| `src/main/` | 主进程入口、窗口、托盘、应用生命周期 |
| `src/preload/` | `contextBridge` 暴露的最小能力集合 |
| `src/ipc/` | IPC 通道定义、参数与发送方校验 |
| `resources/` | 应用图标等打包资源 |

当前只有一个最小窗口，入口为 `src/main/index.ts`。无需桥接能力，因此 `preload/`、`ipc/` 仍占位。

先在仓库根运行 `bun run dev`，再在另一个终端运行 `bun run dev:desktop`。开发窗口加载 `http://127.0.0.1:3000`，主进程修改后重新启动该命令。Electron 44 的官方 CLI 在首次启动时下载二进制。

仓库根的 `bun run build` 会先构建 Web，再构建主进程并把 Web 静态产物复制到 `dist/renderer`。保持独立后端运行，在本应用目录执行 `bun run start`，即可通过 `app://platform` 加载静态页面；不需要 Nuxt 开发服务器。协议只服务构建目录内的文件，页面导航支持 SPA 回退。

`turbo.json` 显式声明对 Web 构建任务的依赖，不运行时导入 `@platform/web` 源码。本轮构建输出为本地可运行目录，未接入安装包、签名或自动更新。

Electron 主进程使用内置 Node.js，渲染进程使用 Chromium。桌面端连接统一部署的 Elysia 后端，不启动本机业务后端。

窗口已启用上下文隔离与沙箱，关闭 Node 集成，拒绝新窗口及跨来源页面导航。页面测试请求直接使用与浏览器相同的 Alova / Eden 客户端。
