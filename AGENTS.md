# 项目约定

## 迁移与复用优先

- 原项目：`/Users/leonwillow/Downloads/shadcn-nextjs-aidesk-app-template-1.0.0`。
- 样式参考：<https://shadcn-nextjs-aidesk-app-template.vercel.app/inbox>。
- 新增、修改页面或组件前，必须先检查原项目及当前项目是否有相同、类似、可复用实现。组件优先查看原 `src/components`，页面优先查看原 `src/app` 和 `src/views`。
- 优先直接迁移源码，再做当前技术栈所需的最小适配；禁止看着参考随意重写另一套实现。原代码只读。
- 修复样式或统一规范时，先在原有结构上调整令牌和必要属性；不得借规范化替换已有可用的组件组合、DOM 结构或交互实现。
- 原项目没有合适实现时，再根据已有技术栈的官方组件、示例与相关技能实现，保持整体样式协调。
- 迁移范围遵循用户指定顺序。目前为根布局、工作台图标导航及菜单、主题、中文，以及账号密码登录/注册页面；右侧业务页面留空，不自行扩展业务模块。
- 登录/注册直接复用原 `src/views/login`、`src/views/register` 与 `src/components/auth`，移除第三方登录，使用账号密码。当前仅前端表单，不模拟认证成功、不保存密码；真实认证后续通过 Elysia/Eden 接入。
- 原丝绸背景按逐像素 Canvas 2D 算法迁移，限制绘制分辨率与帧率、复用缓冲；隐藏、小屏幕和减少动态效果场景暂停持续绘制，避免装饰动画阻塞输入。

## 技术栈与目录职责

- 项目必须使用纯 SPA / CSR，前后端分离。禁止添加 SSR、SSG、React Server Components、Next.js 运行时或服务端渲染入口。根布局和工作台布局都是客户端 React 组件。
- 使用 Bun 管理依赖、脚本、运行服务端；不引入 npm/pnpm/yarn 锁文件。
- Web 和未来 Electron renderer 使用同一套 `apps/web` 前端和 Elysia/Eden API；不复制业务页面或后端逻辑到桌面壳。
- 当前尚未创建 Electron 主进程；需要桌面能力时再添加薄的 `apps/desktop`，不要将 Electron/Node API 混入 React 组件。
- 路由使用 TanStack Router 文件路由，根布局在 `__root.tsx`，工作台使用 `_workspace` 无路径布局。路由文件只组织页面、参数和加载逻辑，后续业务页面放 `views/<feature>`。
- `apps/web/src/components/layout` 存放布局及导航菜单，`configs` 存放配置，`contexts` / `hooks` 存放 React 状态与行为，`assets` 存放导航数据和本地资源，`lib` / `utils` 存放非视图代码。
- `packages/ui/src/components` 只放可复用基础组件；统一设计令牌和全局样式在 `packages/ui/src/styles/globals.css`。基础组件与 shadcn 配置沿用原项目 Base UI / base-mira。
- 使用主题语义类（`bg-background`、`bg-sidebar`、`text-primary` 等）；状态颜色也通过语义变量定义。不要随意覆盖主题颜色或另建样式体系。
- UI 默认中文，品牌名称和字体名称保留原名。所有可点击图标都应有中文可访问名称。
- `apps/server/src/app.ts` 导出无监听副作用的 Elysia 工厂及类型，`index.ts` 仅负责环境加载和启动；后续业务 API 按 `modules/<feature>` 组织。
- 客户端只通过 `import type` 引入服务端契约，使用 Eden；不要把服务端环境配置或运行时代码带入浏览器。
- `packages/auth` / `packages/db` 保留原有目录职责，目前是预留模块。布局和健康检查不应依赖认证或数据库。

## 排版、控件与界面缩放

- 界面缩放统一由 `packages/ui/src/styles/globals.css` 的 `--ui-scale` 和根 `rem` 管理，四档为小 90%、中 95%、大 100%、特大 105%。不要局部覆盖 `--text-*` 或 `--spacing` 模拟缩放，也不要用 `zoom` / `transform: scale()` 缩放页面。
- 字号使用标准 `text-xs` / `text-sm` / `text-lg` 等令牌；控件用 `text-control`，辅助小字用 `text-caption`。禁止硬编码 `text-[12px]` / `text-[0.625rem]`、内联 `fontSize` / `lineHeight` 或另一个 CSS 字号体系。
- 间距、图标和结构尺寸使用可随 rem 缩放的 Tailwind 令牌；像素单位仅适用于边线、焦点轮廓等装饰或确有需要的媒体边界，不得用于正文和控件字号。
- Button / Input / SelectTrigger / 分段 RadioGroup 的单行高度共用 `control-xs/sm/md/lg` 令牌。通过基础组件的 `size` 属性选择，不在页面用 `h-*` / `size-*` 覆盖。相同层级控件必须同档、同字号；标题和说明保留排版层级。
- 分段单选保留原 `ThemeCustomizer` 的 `Label > RadioGroupItem` 结构及 Tooltip 渲染 Label 的组合。`RadioGroup variant="segmented"` 仅集中管理行高、字号、图标和焦点；Label 沿用原边框、选中态和首尾圆角，不用 padding 和子文字行高撑出另一套高度。禁止把原组合换成直接绘制分段外观的 Radio。
- 新尺寸/排版规则先加到共享基础组件与令牌，不在业务页面拼一次性样式。迁移原代码时检查并适配其硬编码尺寸。
- `bun run lint` 包含 UI 规范检查，拒绝临时字号、内联字号和业务页面直接覆盖单行控件高度/字号。规则实现与回归用例在 `scripts/check-ui-styles.ts` / `.test.ts`。
- 主题格式的 `version: 2` 只属于持久化和跨窗口传输的序列化边界，不进入业务 Settings 类型；旧三档中的 `lg` 解码为 `xl`，新版本 `lg` 保留。初始化、刷新和跨窗口同步必须使用同一编解码规则。

## 验证

- 对相关改动执行 `bun run lint`、`bun run check-types`、`bun run build`。
- API 契约改动执行 `bun run test:api`。
- UI 规范或主题存储改动执行 `bun run test:ui`；涉及缩放时，在浏览器比较四档的控件高度、标题/说明/标签/选项字号、图标与间距，并检查键盘、刷新和小窗口。
- 布局/主题改动在浏览器验证外观、导航、菜单、快捷键及刷新持久化；不为纯布局写镜像测试。
- 不手动修改生成的 `routeTree.gen.ts` / `env.ts`；需要时运行 Vite / `bun run env:generate`。

迁移来源及框架适配说明见 `docs/layout-migration.md`，认证页面的来源、改动与性能修复见 `docs/auth-migration.md`。

自定义主题的官方源码来源、必要适配与状态边界见 `docs/custom-theme-migration.md`。后续调色功能优先复用 `components/theme-editor` 和 `utils/theme`；主题库与当前选择必须作为一个快照保存，草稿预览不得持久化，不能通过 CSS 导入绕开现有缩放/排版约束。
