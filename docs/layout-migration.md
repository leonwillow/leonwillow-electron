# 布局迁移记录

源目录：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`。仅从源目录读取代码，未修改原项目。

## 清理与范围

开始时前端、服务端入口和基础组件目录已经为空。保留现有 `apps` / `packages` 结构，清理残留的认证示例实现、未使用表单/路由开发工具依赖，以及指向缺失文件的认证生成脚本。`auth` / `db` 的目录、依赖和数据库工具保留为后续预留；不生成业务表或连接数据库。

首次阶段仅根布局、工作台图标栏及所有菜单、主题设置和中文。所有菜单目标建立空白路由出口，不迁移右侧业务内容。认证出口位于工作台布局之外，沿用原模板边界。`/` 跳转 `/inbox`。随后迁移的账号密码登录/注册见 [认证页面迁移](./auth-migration.md)。

## 文件来源

以下原路径均相对于源项目，当前路径相对于本仓库。

| 原项目 | 当前项目 | 适配 |
| --- | --- | --- |
| `src/app/layout.tsx` | `apps/web/src/components/layout/RootLayout.tsx`、`routes/__root.tsx`、`main.tsx`、`index.html` | 拆分 HTML、SPA 启动和主题 Provider；中文文档语言；不迁移 SEO/JSON-LD |
| `src/app/(dashboard)/layout.tsx` | `apps/web/src/components/layout/WorkspaceLayout.tsx`、`routes/_workspace/route.tsx` | 保留容器、Tooltip 和用户；暂不迁移业务 Store、server actions 或页面 |
| `src/components/layout/{AppSidebar,AuthLinksMenu,CommandMenu,Logo,ModeToggle,ProfileMenu,ThemeCustomizer,ThemeProvider}.tsx` | `apps/web/src/components/layout/` 同名文件 | 直接复制，Next 路由改 TanStack；中文文案、菜单分组及可访问标签 |
| `src/components/ui/{avatar,button,command,dialog,dropdown-menu,input,input-group,label,popover,radio-group,select,sonner,textarea,tooltip}.tsx` | `packages/ui/src/components/` 同名文件 | 直接复制、调整导入；命令标题移入 Dialog 内容，通知区域中文 |
| `src/app/globals.css` | `packages/ui/src/styles/globals.css` | 保留全局语义色、圆角、明暗、缩放；增加扫描路径及在线状态语义变量 |
| `src/lib/utils.ts` | `packages/ui/src/lib/utils.ts` | 原 clsx + tailwind-merge，替换初始化的 cn 包 |
| `src/assets/data/{navigation,search}.ts` | `apps/web/src/assets/data/` | 直接复制并中文化，路由目标接入类型检查 |
| `src/assets/svg/logo.tsx`、`public/images/avatars/avatar-1.webp` | `apps/web/src/assets/` | 原资源；头像用 Vite 静态导入 |
| `src/configs/{themeConfig,theme-settings,theme-presets}.ts`、`src/types/theme.ts` | `apps/web/src/configs/`、`types/` | 完整保留默认值、预设颜色值与设置类型，标签中文 |
| `src/configs/fonts.ts` | `apps/web/src/configs/fonts.ts`、`styles/fonts.css` | 保留字体目录，用同字体 Fontsource 本地 latin 子集替换 next/font；Geist Pixel 保留同版本字体及许可 |
| `src/contexts/settings-context.tsx` | `apps/web/src/contexts/settings-context.tsx` | 保留更新、BroadcastChannel、快捷键和变量应用；清除上个预设残留，圆角/缩放尊重用户设置 |
| `src/hooks/use-object-cookie.ts` | `apps/web/src/hooks/use-object-storage.ts`、`lib/theme-settings.ts` | cookie 改 localStorage，增加校验和 storage 同步 |
| `src/hooks/use-settings.ts` | `apps/web/src/hooks/use-settings.ts` | 原上下文访问 |
| `src/utils/theme-script.ts` | `apps/web/src/utils/theme-script.ts` | 同一初始化算法在 React 挂载前执行，替代服务器 cookie 和脚本生成 |
| `src/contexts/current-user-context.tsx`、`src/fake-db/current-user.ts`、`src/utils/inbox-utils.ts` 的布局片段 | `apps/web/src/contexts/current-user-context.tsx`、`configs/workspace.ts`、`types/user.ts`、`utils/presence.ts` | 仅提取布局依赖，暂不迁移团队和收件箱 Store |

## Web / Electron 与 API 边界

前端是纯 SPA / CSR，前后端分离，不使用 SSR、SSG、React Server Components 或 Next.js 运行时。相对构建路径、打包资源、本地字体、localStorage，以及 `file://` 下的 hash history 为后续复用同一 renderer 保留兼容性。Electron 壳及打包尚未创建或验证；未来可添加薄的 `apps/desktop`。

`apps/web/src/lib/api.ts` 只通过 `import type { App } from "server/app"` 引入契约，运行时使用 Eden。当前没有页面调用 API。服务端工厂与监听分开，仅提供 `/api/health`；Bun 测试直接传入 Elysia 实例，不需数据库或网络监听。

实现对照 [TanStack 无路径布局](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts)、[Eden 实例测试](https://elysiajs.com/eden/treaty/unit-test) 和已安装 Turborepo 的目录/内部包文档。

## next-themes 的直接复用

直接使用原模板的 `next-themes@0.4.6` 和 `ThemeProvider`，不修改依赖源码。该 Provider 的脚本是客户端主题初始化功能，不是服务端渲染入口；前端仍由 Vite 和 React `createRoot` 在浏览器运行。挂载前的 `initializeTheme()` 只接续原主题预设、字体、圆角和缩放初始化。

此前移除依赖初始化脚本的补丁没有必要，已撤回。纯 CSR 下首屏初始化已在 `main.tsx` 执行，使用原库公开 `scriptProps` 属性将其初始化片段保留为惰性文本，避免 React 对客户端内联脚本的警告，不修改库实现。Provider、系统主题监听、localStorage 明暗模式、跨窗口同步和 transition 处理沿用原库。

## 复用审核与纠正

逐项对照全部 14 个基础组件、布局和菜单、主题配置/预设/字体、主题上下文与存储、导航和搜索数据。11 个主题预设的所有颜色值与原项目一致，原全局明暗语义色未改写，18 个字体选项保留。CSR、TanStack 路由、本地字体、中文、可访问名称和空白业务出口是本次迁移所需适配。

- 撤回分段控件的结构重写：恢复原 `ThemeCustomizer` 的 Label 包裹隐藏 RadioGroupItem，圆角 Tooltip 也恢复渲染 Label；RadioGroupItem 函数重新从原文件复制。只在 RadioGroup 集中适配用户要求的行高、字号、图标和焦点。
- 恢复原 HTML/body 根类，补回 `antialiased`；保留 `Ghibli Studio`、`Marvel`、`Material Design` 原品牌名称。
- 修复新增共享令牌的合并适配：保留原 clsx + tailwind-merge 流程，注册控件字号和尺寸令牌，防止按钮前景色、小字和大档高度被误合并。回归测试使用实际 Button variant 和冲突类组合。
- 初始化、storage 事件和 BroadcastChannel 使用同一主题编解码。版本仅存在序列化数据中，避免旧窗口的三档“大”覆盖新版缩放含义。

后续统一规范应在原组合上做最小调整，不能作为替换原结构和交互的理由。

## 验证

后续主题面板统一尺寸及四档缩放的调整见 [UI 规范](./ui-conventions.md)，该文档说明原缩放规则的缺陷及此次适配。

Biome、全工作区类型检查、生产构建、Eden 健康检查/CORS 测试；浏览器验证导航、菜单、中文搜索、主题快捷键、预设、字体、圆角、缩放、刷新恢复及同源窗口同步。本次 3001 被另一个项目占用，前端在 Vite 自动选择的 3002 验证，服务端在 3000。
