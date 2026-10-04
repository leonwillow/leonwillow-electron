# 项目约定

## 复用与范围

- 原项目只读：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`；[样式参考](https://shadcn-nextjs-aidesk-app-template.vercel.app/inbox)。
- 新增或修改前先查原项目及当前项目。组件查原 `src/components`，页面查原 `src/app` / `src/views`；优先直接迁移源码，只做必要适配。原项目没有合适实现时，使用技术栈的官方组件、示例和相关技能。
- 统一样式时优先调整共享令牌和必要属性，保留已有可用的组件结构与交互，不借规范化重写实现。
- 按用户指定顺序和范围迁移，不自行扩展业务模块。界面默认中文，保留品牌和字体名称；可点击图标提供中文可访问名称。

## 技术与目录

- 纯 SPA / CSR、前后端分离；禁止 SSR、SSG、RSC 和 Next.js 运行时。依赖、脚本和服务端使用 Bun，只保留 Bun 锁文件。
- Web 与未来 Electron 共用 `apps/web` 和 Elysia/Eden API。桌面壳放 `apps/desktop`，不复制业务逻辑，不在 React 组件中使用 Electron/Node API。
- 使用 TanStack Router 文件路由。路由文件只组织页面、参数和加载逻辑；页面放 `views/<feature>`，布局及导航放 `components/layout`，配置、状态、资源和工具沿用现有目录职责。
- 基础组件放 `packages/ui/src/components`，沿用 Base UI / base-mira；主题、排版、控件尺寸和 rem 缩放统一在 `packages/ui/src/styles/globals.css`。使用语义颜色和共享令牌，不在页面硬编码字号或覆盖控件尺寸。
- 服务端 `app.ts` 导出无监听副作用的 Elysia 工厂及类型，`index.ts` 负责启动，业务 API 放 `modules/<feature>`。客户端通过 Eden 调用，只用 `import type` 引入服务端契约。
- `packages/auth` / `packages/db` 保留原职责；布局和健康检查不依赖认证或数据库。认证未接入时不模拟登录成功、不保存密码。
- 不手改 `routeTree.gen.ts` / `env.ts`，使用对应生成命令。
- 手工维护的文件名统一使用 kebab-case；路由特殊名称、工具固定入口和 `index.ts(x)` 保留各自约定。组件与类型使用 PascalCase，函数及状态使用 camelCase。
- 源码文件头说明职责、可核实的创建/修改时间、版本作用、主要调用关系、功能与预期结果；API 和关键逻辑补充参数、结果与失败条件。格式与例外见 [注释规范](docs/code-comments.md)，不写迁移口号、逐行翻译或无效工具指令。

## 验证与按需阅读

- 改动运行 `bun run lint`、`bun run check-types`、`bun run build`；API 契约改动加 `bun run test:api`，UI 规范或主题存储改动加 `bun run test:ui`。
- 布局、主题和交互改动在浏览器验证相关外观、导航、键盘、缩放、小窗口及持久化；不为纯布局写镜像测试。
- 修改对应模块前阅读相关文档，具体实现和迁移记录维护在那里：
  - [布局、框架适配与目录边界](docs/layout-migration.md)
  - [排版、控件、缩放与兼容规则](docs/ui-conventions.md)
  - [登录注册来源、行为与背景性能](docs/auth-migration.md)
  - [自定义主题来源、状态与浮动面板](docs/custom-theme-migration.md)
  - [项目结构、命名与拆分依据](docs/project-structure.md)
  - [文件头、函数与 API 注释](docs/code-comments.md)

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
