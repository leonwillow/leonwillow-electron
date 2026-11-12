# 项目结构与依赖边界

维护日期：2026-11-10。当前是 Bun 工作区中的纯 CSR 应用；目录调整以职责变化为依据。

| 目录 | 职责 | 归属判断 |
| --- | --- | --- |
| `apps/web/src/routes` | TanStack 路由、加载、参数和访问前置 | 页面展示交给 views；不在这里堆表单或业务组件 |
| `views/<feature>` | 页面及专用组件、表单校验和局部 Hook | 仅一个功能使用的代码优先放在功能旁 |
| `components/layout` | 应用壳、导航和跨路由宿主 | 不承担业务 API 实现 |
| `components/auth`、`components/theme-editor` | 跨页面认证展示、主题编辑界面 | 局部交互状态留在所属组件/局部 Hook |
| `stores` | 跨组件、跨路由共享状态及明确的提交操作 | 说明持久化范围、草稿范围和同步责任；不把局部输入全部全局化 |
| `hooks` | 跨功能复用的 React 行为 | 尚未跨功能复用的 Hook 就近维护 |
| `lib` | 应用接口适配、领域规则和编解码 | 如 Eden 客户端、主题库规则和快照协议 |
| `utils/theme` | 纯颜色、CSS 和阴影计算 | 不读写浏览器存储；已有 `utils/theme-script.ts` 是明确的 DOM 适配例外 |
| `configs`、`types` | 静态目录/默认值、多处共享类型 | 局部 Props 和单表单类型仍就近；类型优先从运行时模型推导 |
| `assets`、`styles` | 字体/图片/来源数据、字体加载 | 排版和控件令牌统一在共享 UI 的 globals.css |
| `apps/server/src/app.ts` | 无监听、无环境加载的 Elysia 工厂及 Eden 契约 | 健康检查可独立创建，无需数据库 |
| `apps/server/src/index.ts` | 进程装配、信号与资源所有权 | 常规启动不创建账号、不执行数据库迁移 |
| `apps/server/src/server-resources.ts` | 当前服务共用的 auth、db、可选 fundsGraph 和安全配置 | 启动时绑定一次，停止后解绑；不保存用户、会话或事务 |
| `apps/server/src/modules/<feature>` | 功能 HTTP 边界、模型、服务和必要适配 | 纯计算不必变成 Elysia 插件；按实际职责新增文件 |
| `apps/desktop` | Electron 窗口、preload、连接配置、会话隔离与协议转发 | 使用同一 Web 构建产物，不包含后端、数据库或另一套业务视图 |
| `packages/desktop-bridge` | 桌面连接类型、地址校验与固定应用来源 | Web/主进程/后端共用的纯契约，不依赖 Electron、Node、UI 或应用运行时 |
| `packages/ui` | Base UI 组件、语义样式、cn | 不依赖应用路由、账号或 Store |
| `packages/access` | 现有功能标识、名称、路由和访问规则 | 前后端共用的纯 TypeScript 目录；不依赖认证、数据库或 UI |
| `packages/auth` | Better Auth 配置、工厂、显式初始化、schema 生成适配 | 依赖 db；不自行加载部署环境或监听 |
| `packages/db` | Pool/Drizzle 工厂、表、关系和迁移 | 调用方关闭 pool；运行时代码不依赖应用 |
| `packages/config` | 共享 TypeScript 基础选项 | Web、UI、Bun 测试分别覆盖环境 |
| `scripts` | 仓库检查和部署 smoke check | 根 tsconfig 只负责这些脚本 |

Web 运行时使用共享 UI、纯规则目录和客户端库；通过 `import type { App } from "server/app"` 引入契约。Server 装配 auth/db，auth 依赖 db，跨包通过公开 exports。基础包不能导入应用运行时；Tailwind 扫描应用路径与数据库工具的环境定义导入属于工具配置，应明确记录，不能据此放开 JS 反向依赖。

业务路由直接导出命名 Elysia 实例，通过 `.use(authModule)`、`.use(accessModule)`、`.use(adminModule)` 注册。`createApp()` 只组装 HTTP 应用，不传递 auth/db/Origin；服务在实际处理请求时从 `server-resources.ts` 读取已初始化实例。业务函数的参数保留请求数据、操作者和数据库事务；事务内辅助函数始终使用显式传入的 tx，不能退回共享 db 写入。

`index.ts` 声明路由，`service.ts` 导出普通业务函数，不创建 Elysia 实例或接收整个 Elysia 上下文。跨路由复用的 HTTP 钩子与宏明确放在 `plugin.ts`：`accessPlugin` 读取并校验会话、转交 Cookie、映射错误响应，调用普通 `getAccess()` 判断身份和授权。业务服务可以直接引用权限规则与错误类型，不会同时加载插件。

认证的登录、会话和退出接口直接调用 `http.ts` / `response.ts` 的适配函数，不再创建请求操作对象或包一层认证宏，也不保留空的 `service.ts`。客户端地址在 HTTP 适配器统一按受信代理配置解析；真实连接地址由路由从监听器取得。Cookie、限流头和公开字段转换继续由响应适配器负责。

当前服务进程只运行一套认证和数据库配置，不支持在同一进程并存多套独立后端；资源模块拒绝重复绑定。集成测试按用例串行绑定独立 schema，关闭 HTTP 后解绑再清理数据库。若将来确实出现同进程多实例需求，再调整资源边界。

当前数据库工具通过 `packages/db/.env.schema` 复用 Server 的数据库环境定义；这是保留的工具耦合。只有出现独立部署/第二个服务端需求再拆出中立契约。没有立即加入 domain/repository 等空目录。

UI 包的源码由 Vite 消费；内部包无需为形式统一各自创建 dist。手工文件用 kebab-case，路由特殊名及固定工具入口保留惯例。Electron 壳位于 `apps/desktop`，构建时复制同一 Web 产物；主进程负责本地协议和可配置 API 转发，React 不导入 Electron/Node。登录设置仍位于 `views/login`，基础地址契约位于 `packages/desktop-bridge`。构建、打包命令及当前验收范围见 [Electron 桌面适配](./desktop-migration.md)。

生成与检查责任见 [工程验证](./engineering-verification.md)，注释见 [注释规范](./code-comments.md)，基线问题见 [评审记录](./project-structure-review.md)。

文书取号的模板版本、年度计数、简要取号及可选 Word 生成见 [文书取号](./document-numbering.md)。数据归 `packages/db`，事务与模板生成归 `modules/documents`，CSR 页面归 `views/documents`；预览器按需加载，应用壳不承担文书处理。

笔录功能的来源和行为见 [笔录功能](./inquiries-migration.md)。目录搜索、状态筛选、树行操作与导航 Provider 位于 `components/layout`；`inquiry-editor-actions.tsx` 协调目录操作前的保存和编辑锁，编辑、常用人员和 A4 实测分页位于 `views/inquiries`；Eden 适配位于 `lib/inquiries.ts`，HTTP/事务/校验/Word 导出位于 `modules/inquiries`，三张持久表及生成迁移位于 `packages/db`。笔录直接复用现有认证和 PostgreSQL，不依赖资金图或文件对象存储。

资金调查的实现边界见 [案件基础版本](./funds-investigation-design.md) 与 [导入规范](./funds-import.md)。`modules/funds` 将纯解析、归并、字段导出和 Neo4j 适配分开；案件及来源表归 `packages/db`。`views/funds` 负责页面，`lib/funds.ts` 只做 Eden 调用和显示转换；图组件按需加载 G6，没有把测试流水打包进客户端。图连接由服务入口关闭，不影响独立健康检查。`ai-normalizer.ts` 管理版本化 AI 映射与确定性转换，`jobs.ts` 管理 PG 持久任务与租约，`canonical.ts` 负责稳定交易 ID 和案件主体，`case-links.ts` 负责明确确认的跨案快照。`apps/server/src/funds-worker.ts` 为独立后台入口，`submit-funds.ts` 将完整目录提交到同一队列。规范交易、任务、文件检查点和跨案纳入记录均归 `packages/db`；页面 `pipeline-panel.tsx`、`case-links-panel.tsx` 分别展示处理过程和跨案操作。

资金调查页面按工作职责拆分：`views/funds/index.tsx` 只组织资金分析，`cases-view.tsx` 组织案件与资料管理；`routes/_workspace/funds_.cases.tsx` 使用 TanStack 非嵌套路由约定，地址为 `/funds/cases`，不嵌套分析视图。两页沿用同一案件 API 与授权，通过 `funds-header.tsx` 提供模块内部导航和统一页头，导航通过 URL 传递当前案件；全局侧栏只提供一个资金分析入口。

案件二级菜单位于 `components/layout/funds-case-sidebar.tsx`，沿用原 KnowledgeBaseSidebar 的结构。`funds-navigation-provider.tsx` 仅把资金入口绑定到统一工作台导航，不再创建独立 Provider；`workspace-layout.tsx` 根据模块权限提供可用内容，宽窗口固定时让出内容空间，窄窗口回到浮动模式。只存储按用户区分的固定开关，案件内容继续通过 Eden 读取。

2026-10-13：案件与文书类型菜单共用 `components/layout/use-workspace-menu.ts` 的悬停、延迟关闭、键盘、固定和拖动保护。各自的导航 Provider 保留独立上下文和用户偏好键；文书 Provider 额外协调目录刷新与类型选择，页面加载和模板管理通过目录回写忽略旧请求。两套菜单由 `workspace-layout.tsx` 按模块授权挂载；目录与文书处理仍经 Eden，不迁入应用壳实现。

2026-11-04：二级菜单由 `workspace-navigation-provider.tsx` 在用户工作台中唯一创建状态，`use-workspace-menu.ts` 管理悬停/焦点、计时器和响应式停靠，`lib/workspace-menu-state.ts` 管理内容切换及统一固定偏好的读写和旧值合并。模块适配入口只绑定菜单 ID，不创建另一份固定或展开状态。

`workspace-secondary-menu.tsx` 持续调用资金、文书和笔录的菜单内容 Hook，选择当前内容后只渲染一次 `workspace-menu.tsx`。内容契约为 `label`、`title`、`toolbar`、`children` 和可选的 `dialogs`；标题、固定按钮和外框只存在于共享组件中，弹窗单独渲染。业务数据仍经 Eden 读取，未授权的菜单不可显示，资金目录加载及文书/笔录资源也遵循模块授权。新增同类菜单应注册内容及入口，不再增加菜单框 Provider 或独立固定存储键。

## 全局删除约定（2026-10-06）

业务资料统一标记删除，不提供物理清除接口。案件使用 `deleted_at` / `deleted_by`；被删除案件在列表、详情、分析、导出、原件下载、跨案线索及新任务中均不可访问。仅归档案件允许删除，删除与后台任务取消在同一事务提交，Worker 提交前重查案件状态。PostgreSQL 原始来源、规范交易、历史版本、任务记录，Neo4j 案件图以及 RustFS 原件继续保留，均不因删除案件而清除。

规范交易重新归并时，旧交易只标记失效，有效交易按稳定 ID 更新或恢复；各次完整快照保存在版本表中。跨案排除继续使用 `active=false`，只撤销目标案的纳入关系。授权撤销使用 `deleted_at` 并由权限读取统一过滤，恢复授权复用原行；自定义主题保留带 `deletedAt` 的本地快照并从选择器隐藏，删除当前主题回退默认。新增业务模块沿用此约定。

认证会话/令牌的撤销与过期清理、临时对象 URL、请求头等运行时清理不属于业务资料删除，沿用原生命周期。Neo4j 为当前有效规范数据的可重建分析投影，资料变更的投影重建仍可替换节点/边；案件删除本身不触发图重建或物理清理。测试仅在独立随机 schema、案件 ID 与对象桶中做测试资源清理，不清理用户案件。

2026-11-04：共享二级菜单分栏位于 `components/layout/workspace-panels.tsx`，基础 ReUI 组件位于 `packages/ui/src/components/resizable.tsx`；宽度偏好的校验读写位于 `lib/workspace-menu-width.ts`，持续状态与跨窗口同步由 `use-workspace-menu-width.ts` 提供，并只在统一菜单控制器创建一次。

2026-11-05：`packages/calculators` 存放前后端共用、无DOM/数据库依赖的整数计税和导入规则；数据库只以类型引用领域结构。计算器 API 在 `modules/calculators`，页面在 `views/calculators`，导航在布局目录；详见 [计算器适配](./calculators-migration.md)。

2026-11-05：`packages/lattice-grid` 封装泛型网格内核及 ReUI React 视图，依赖共享 UI，供页面组合；业务字段与提交逻辑留在页面。首个消费者为增值税月度表，见 [Lattice Grid 适配](./lattice-grid-migration.md)。

2026-11-06：移除未接入 Bun 工作区的 `apps/server-java`，包括 Spring Boot 源码、Maven 模块配置、专属 IDE 配置和本地编译产物。应用后端统一由 `apps/server` 的 Bun/Elysia 服务承担。
