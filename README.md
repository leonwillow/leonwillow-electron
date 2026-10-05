# leonwillow-electron

采用纯 SPA / CSR、前后端分离：Vite + React 负责前端，Bun + Elysia 提供独立 API，Eden 连接两端。不使用 SSR、SSG 或 React Server Components。

逐步迁移 AIDesk Next.js 模板的工作台。当前已迁移根布局、左侧固定图标导航、菜单交互、完整主题设置、中文，以及账号密码登录/注册页面；右侧业务页面尚未迁移。

## 开发

```bash
bun install
bun run db:start
bun run db:migrate
bun run dev
```

前端默认 <http://localhost:3001>，根路径进入 `/inbox`；未登录时转到 `/login`。端口占用时 Vite 会显示实际可用端口。服务端默认 <http://localhost:3000>，健康检查为 `/api/health`。

当前已接入账号密码认证，正常启动需要 PostgreSQL 和认证环境配置。普通启动不创建账号；管理员通过 `bun run auth:init` 和显式注入的初始密码创建，已有密码与角色不会被覆盖。环境配置、旧数据库迁移说明及测试要求见 [后端认证](./docs/auth-backend.md)。健康检查测试仍可独立运行，不要求数据库。

```bash
bun run dev:web       # 仅前端
bun run dev:server    # 仅 Elysia
bun run check         # 完整验证（不自动修复手写源码）
bun run fix           # Biome 自动整理
bun run verify:all    # 完整验证 + 真实数据库测试
bun run lint          # Biome、前后端导入边界和 UI 规范检查
bun run check-types   # 工作区 TypeScript 检查
bun run build         # 前后端生产构建
bun run test:api      # 健康检查、CORS 与真实数据库认证测试
bun run test:ui       # UI 规范、主题存储、样式合并和账号表单校验
bun run test:architecture # 浏览器导入边界和内部包出口回归
bun run generate      # 生成环境类型和路由树
bun run auth:schema   # 安全再生成认证表，手写关系独立
bun run auth:init     # 显式初始化管理员；密码注入方式见后端文档
```

检查、生成顺序、冷启动与子路径验收见 [工程验证](./docs/engineering-verification.md)。Web 默认部署在 `/`；子路径构建使用 `--base=/desk/`，Router 自动使用同一前缀，托管端仍需配置 SPA fallback。

环境默认值在各应用 `.env.schema`，本地 `.env` 可覆盖默认值，请勿提交秘密。修改服务端端口时同步调整 `VITE_SERVER_URL`，修改前端来源时同步调整 `CORS_ORIGIN`。

## 目录职责

```text
apps/
  web/                         # Web / 未来 Electron 共用的 React renderer
    src/
      main.tsx                 # 启动、主题首屏初始化及路由实例
      routes/                  # TanStack 文件路由，仅组织布局和视图
        __root.tsx             # 根布局：主题和全局提示
        _workspace/            # 工作台无路径布局及模块路由
      components/layout/       # 直接迁移的布局和所有图标栏菜单
      components/auth/         # 原认证页面壳、展示面板、表头和密码字段
      components/theme-editor/ # 主题调色部件与自定义主题菜单
      views/login/             # 原登录视图、表单、账号校验
      views/register/          # 原注册视图、表单、账号校验
      configs/                 # 品牌、默认值、11 套主题预设、18 个字体选项
      stores/                  # 主题偏好、主题库、持久化与临时预览
      hooks/                   # 可复用的 React 行为和主题颜色解析
      assets/                  # 原导航与搜索数据、Logo、头像、本地字体
      styles/fonts.css         # next/font 的 Vite 本地字体适配及中文回退
      lib/                     # Eden/认证客户端、主题库规则与快照编解码
      types/                   # 布局及主题类型
      utils/                   # 主题/CSS/颜色/阴影算法及 DOM 适配
  server/
    src/app.ts                 # 可测试 Elysia 工厂及 App 类型
    src/index.ts               # 环境装配、监听、信号与连接池生命周期
    src/init-admin.ts          # 显式管理员初始化命令
    src/modules/auth/          # 认证路由、接口契约与 Better Auth 适配
    test/                      # Bun + Eden 健康检查和认证测试
packages/
  ui/src/components/           # 原模板 Base UI 基础组件
  ui/src/styles/globals.css    # 全局语义样式与明暗设计令牌
  ui/src/lib/utils.ts          # 原模板 cn（clsx + tailwind-merge）
  auth/                        # Better Auth 工厂、配置、管理员初始化和生成工具
  db/                          # PostgreSQL 连接、Drizzle schema 和迁移
  config/                      # 共享 TypeScript 配置
```

后续业务页面放入 `apps/web/src/views/<feature>`，路由只挂载视图。以后 Electron 主进程只加载这份 renderer，并调用同一个 Elysia 后端；本次尚未添加或验证 Electron 主进程及打包。

目录选择、命名和拆分依据见 [项目结构](./docs/project-structure.md)，注释格式见 [注释规范](./docs/code-comments.md)。

## 主题与交互

- 图标栏保留原模块入口，以及底部认证入口、搜索、在线消息设置、通用设置、主题面板、明暗切换和个人菜单。
- 主题面板保留默认主题及原 11 套预设、18 个字体选项、浅色/深色/跟随系统、圆角、缩放和重置。缩放四档为小/中/大/特大（90%/95%/100%/105%），控件高度与字号统一，所有文字和间距随根 rem 缩放。
- 主题面板的“设置”入口支持自定义浅深色、字体、圆角和阴影，实时预览、命名保存/修改/删除、CSS 导入导出；复用 shadcn Studio 官方公开的调色和主题算法。来源、必要适配及保存边界见 [自定义主题迁移](./docs/custom-theme-migration.md)。
- 设置保存在 `localStorage["aidesk-theme-settings"]`，刷新后恢复，支持同源窗口同步。`D` 切换明暗，`⌘/Ctrl+K` 或 `/` 打开搜索；输入框中不抢占这些快捷键。
- 导航、搜索和个人菜单使用真实路由；业务页当前均为空白。工作台统一检查真实会话，个人菜单显示登录用户，退出会删除会话并返回登录页。
- 原字体的拉丁子集本地打包，中文使用系统中文字体回退，无 Google Fonts 运行时请求。
- `/login` 与 `/register` 直接复用原认证页面，去掉第三方登录并通过 Eden 使用账号密码认证；内部邮箱由服务端生成，不向用户展示，浏览器不保存密码。原丝绸背景已限制绘制成本并支持隐藏暂停与减少动态效果。
- 后续 shadcn CLI 使用 `bunx --bun shadcn@latest ... -c packages/ui`，先检查原模板和已迁移组件，禁止覆盖源迁移代码。

项目迁移约定在 [AGENTS.md](./AGENTS.md)，详细来源见 [迁移记录](./docs/layout-migration.md)。

登录/注册的源码来源、改动边界和性能修复见 [认证页面迁移](./docs/auth-migration.md)。

后续排版、控件尺寸和主题存储规范见 [UI 规范](./docs/ui-conventions.md)。`bun run lint` 同时检查这些约束；旧版“大”设置自动迁移为“特大”。
