# 项目结构与工程规范评审

> 评审日期：2026-10-04  
> 代码基线：`44cfac4`（`准备在A处进行修改之前的一次提交。`）  
> 评审目标：从项目结构出发，检查职责边界、框架惯例、统一性、可读性、可维护性与稳定性。  
> 基线评审交付：仅新增此文档。后续工程修正记录见下文；尚未提交或推送。

## 实施记录（2026-10-04）

本文正文保留 `44cfac4` 基线的发现与当时验证结果，不把历史失败描述为修复后的状态。当前实现与可重复命令见 [工程验证](./engineering-verification.md)、[项目结构](./project-structure.md) 和 [后端认证](./auth-backend.md)。

- 本次处理 A01/A02/A03/A04/A05/A06/A07/A08/A09/A10/A14：校正文档与来源、Web base/basepath、生成前置与缓存输出、生成关系隔离、显式管理员初始化、工具/测试类型检查、关闭流程、错误分类、独立测试和验证门禁。
- 补充代理部署边界：仅明确受信的直接代理可提供单值 X-Real-IP；默认不信任转发头。生产域名、HTTPS/Cookie 和实际代理配置仍须由部署环境验收。
- A11 随本次涉及文件校正；其余历史注释继续按需维护。A12 降为 P3，主题编辑会话未重构；A13 保留当前工具环境耦合。
- 第八节属于基线记录；本次结果另记于工程验证文档。评审链接使用正常相对文件路径，避免把行号拼入文件名。

## 一、结论先行

**当前项目的主体结构是合理的，不建议推倒重建，也不建议为了“看起来更规范”整体迁入另一套目录体系。**

目前的方向值得保留：

- `apps/web`、`apps/server` 与 `packages/ui/auth/db/config` 分工明确。
- React 使用 Vite 构建纯 CSR 应用，路由、页面、布局和基础控件已经分离。
- Elysia 使用无监听副作用的应用工厂、按功能划分的模块，以及请求级服务绑定；这与其官方最佳实践的思路一致。
- Eden 的服务端类型契约与浏览器运行时代码有明确边界。
- 主题的持久化偏好、未保存草稿、DOM 同步和纯计算已经有分工，并非所有逻辑都堆在组件里。

**需要优先调整的不是目录名称，而是边界的完整性：文档与代码不同步、生成步骤不完整、生成文件与手写内容混合、Web/桌面部署假设混合，以及启动资源与验证流程尚未完全收口。**

推荐路线是：**保留主体结构 → 修复确定问题 → 补齐工程边界 → 按功能增量整理。**

### 优先级说明

- **P1：优先处理。** 影响正常部署、干净环境可复现性，或需要在对外发布前解决。
- **P2：近期完善。** 有明确维护或稳定性收益，但不意味着当前所有功能都已失效。
- **P3：按需调整。** 主要是后续扩展时的取舍，不应演变成当前的大范围重构。

文中“已确认”表示代码或验证已有证据；“生成风险”“建议”不等同于已经执行并复现了破坏性操作。

## 二、范围、方法与限制

### 2.1 检查范围

以该提交的 177 个受版本控制文件为索引，检查了：

- 根工作区、依赖声明、Bun/Turborepo/Biome/TypeScript 配置及检查脚本。
- Web 启动、路由、认证视图、布局导航、主题组件、状态、配置、类型和工具的主要调用链。
- 共享 UI 的组件封装方式、统一样式入口及浏览器资源生命周期。
- Elysia 应用工厂、进程入口、认证模块、认证包、数据库包及迁移组织。
- 现有测试的职责、执行入口、隔离方式和类型检查覆盖范围。
- README、项目约定、已删除文档与第三方来源记录的 Git 历史。
- 原 AIDesk 模板的目录和命名分层；原项目保持只读。

并对照了 Elysia、React、TanStack Router、Vite、shadcn/ui 的官方资料，以及**本机安装的 Turborepo 2.11.7 随包文档**，而不是把某个社区模板当作唯一标准。

### 2.2 实际环境

以下为本次检查时解析到的安装版本，不是简单抄录 `package.json` 中的范围：

| 工具 / 框架 | 版本 |
| --- | --- |
| Bun / TypeScript | 1.3.14 / 6.0.3 |
| React / Vite | 19.3.0 / 8.3.2 |
| TanStack React Router / Router Plugin | 1.170.41 / 1.168.42 |
| Elysia / Eden | 1.4.30 / 1.4.9 |
| Better Auth / Drizzle ORM | 1.7.5 / 1.0.0-rc.4 |
| Turborepo / Biome | 2.11.7 / 2.5.15 |

安装版本落在声明范围内，本身不构成不规范；可复现安装仍应以 `bun.lock` 为准。

### 2.3 验证边界

- 本次运行过静态检查、构建和现有测试，具体结果见第八节。
- 构建会产生被忽略的 `dist`、缓存和生成物；API 集成测试会创建并清理随机测试 schema。**这不等于完全没有任何文件系统或数据库写入，但没有实施业务源码修改或主动迁移业务数据库。**
- 未做完整浏览器交互回归、正式部署、Electron 打包、压力测试或完整安全审计。
- 未执行会覆盖认证 schema 的生成命令；相关问题依据生成目标和手写内容的重叠确认。
- 二进制资源、生成的数据库快照及第三方依赖不作为逐行审计对象。
- 当前业务页面留白、找回密码未接入、尚无桌面壳，属于已约定的迁移范围，**不作为结构缺陷计数**。

## 三、与官方惯例的对照：哪些应保留

| 领域 | 当前做法 | 评审判断 |
| --- | --- | --- |
| Monorepo | `apps/*` 放应用，`packages/*` 放内部库，使用 workspace 依赖和 Bun 锁文件 | 符合常见及 Turborepo 推荐组织方式，无需改成多个仓库。 |
| React | 函数组件、Hooks、`routes` / `views` / `components` 分离 | 合理。React 不强制统一的 `features` 或 `pages` 目录模板；重点是状态归属、纯渲染和副作用边界。 |
| TanStack Router | 文件路由、`__root.tsx`、`_workspace` 无路径布局、点号嵌套路由 | 符合其命名惯例，不需要照搬 Next.js 的 `app/page.tsx`。 |
| Elysia | `modules/auth/index.ts`、`service.ts`、`model.ts` | 接近官方建议的按功能分组。无需改为全局 `controllers/services/models` 三个大目录。 |
| Elysia 服务绑定 | 有名字的插件与宏，按请求绑定 `request`、客户端 IP、响应头 | 这是有理由的 request-dependent service，不应一律改成类或禁止使用 Elysia 实例。 |
| HTTP 契约 | 从运行时模型推导类型，通过 Eden 使用 `App` 类型 | 方向正确。避免另写一套与路由脱节的 DTO/interface。 |
| 共享 UI | `packages/ui` 包含基础组件、样式令牌和 `cn`，Base UI / base-mira 配置一致 | 与 shadcn monorepo 思路兼容。无需替换已有组件结构、交互或底层库。 |
| 内部包 | UI/auth/db 通过 `exports` 暴露源码，由消费方构建 | 内部源码包是可行策略，不是“缺少每包独立 dist”的错误。 |
| 测试 | 测试位于所属应用或包的 `test/`，根 `scripts/` 放仓库约束测试 | 合理。单数 `test` 不是缺陷，不必搬成 `__tests__`。 |

### 3.1 服务端已有的良好边界

- [应用工厂](../apps/server/src/app.ts) 不读取环境、不监听端口；健康检查不要求先建立认证或数据库连接。
- [进程入口](../apps/server/src/index.ts) 装配环境、数据库、认证与监听，方向正确；缺的是初始化策略和关闭流程，而不是需要再造一套框架。
- 基线中的请求级服务不把请求上下文保存在共享可变单例里。2026-10-05 已移除认证宏包装，当前由[认证路由](../apps/server/src/modules/auth/index.ts)直接调用 HTTP 适配函数；共用权限钩子位于[权限插件](../apps/server/src/modules/access/plugin.ts)。
- [认证工厂](../packages/auth/src/index.ts) 管理 Better Auth 配置与适配器；[数据库工厂](../packages/db/src/index.ts) 管理 Pool/Drizzle 创建，职责不应合并。
- `http.ts` 与 `response.ts` 负责请求转接、多条 Cookie、错误和公开用户字段，属于真实的 HTTP 适配职责，不是单纯为了多建文件。

特别注意：当前 `service.ts` 主要是认证库的请求适配层。未来业务中不依赖请求的纯规则仍应写成普通函数或服务，不必把所有计算都放进宏。

### 3.2 前端已有的良好边界

- [登录路由](../apps/web/src/routes/login.tsx) 只挂载视图；页面组合、表单及校验分别位于 `views/login`。
- [工作台路由](../apps/web/src/routes/_workspace/route.tsx) 负责真实会话检查，布局负责展示；[个人菜单](../apps/web/src/components/layout/profile-menu.tsx) 使用 `getRouteApi`，避免反向导入挂载自己的路由模块。
- [根布局](../apps/web/src/components/layout/root-layout.tsx) 将主题编辑器按需加载并放在 `Outlet` 外，保留跨路由编辑会话。
- [主题 Store](../apps/web/src/stores/theme-store.ts) 管理共享状态和持久化，临时预览不进入持久化快照；[ThemeEffects](../apps/web/src/components/layout/theme-effects.tsx) 连接 DOM 与浏览器事件。
- [主题领域规则](../apps/web/src/lib/custom-themes.ts)、[快照编解码](../apps/web/src/lib/theme-settings.ts) 和 [CSS 草稿转换](../apps/web/src/utils/theme/theme-draft.ts) 已与大段表单分开，默认色板也复用共享 CSS。
- 丝绸背景、浮动面板等确有浏览器副作用的组件有相应的 Effect/观察器清理；不能仅因存在 DOM 操作就判定不符合 React。

## 四、问题与调整建议总览

| 编号 | 优先级 | 结论性质 | 问题 |
| --- | --- | --- | --- |
| A01 | P1 | 已确认 | 规范和操作文档缺失，README 还描述已移除的结构 |
| A02 | P1，发布前 | 已确认缺失，需核实分发义务 | 已迁入第三方源码的来源和许可证记录被删除 |
| A03 | P1 | 已验证 | Web history 路由与统一相对资源 base 导致嵌套地址刷新失败 |
| A04 | P1 | 已确认前置缺口 | 干净检出后的类型检查缺少路由生成前置 |
| A05 | P1 | 已确认覆盖边界风险 | auth schema 生成目标包含手写、被运行时依赖的关系定义 |
| A06 | P1，生产前 | 已确认 | 默认管理员创建策略没有与生产启动隔离 |
| A07 | P2 | 已确认 | TypeScript 根工程职责不明，常规检查未覆盖部分工具和 UI 测试 |
| A08 | P2，生产前 | 已确认 | 进程入口没有完整管理数据库连接池生命周期 |
| A09 | P2 | 部分已验证 | 认证错误分类和内部诊断信息不足 |
| A10 | P2 | 已确认 | 部分认证集成测试依赖前序用例和累计限流次数 |
| A11 | P2 | 已确认 | 文件头说明已有漂移，机械维护调用清单的成本高 |
| A12 | P3，按需 | 维护性建议 | 主题主面板的编辑会话状态转换可以局部提取 |
| A13 | P3 | 已确认配置耦合 | 数据库工具反向依赖应用环境目录，缓存影响范围较宽 |
| A14 | P2 | 工程建议 | 检查入口已有，但缺少统一的只读验证门禁与可见的 CI 约束 |

### A01｜文档与实际结构脱节

**位置：** [AGENTS.md](../AGENTS.md)、[README.md](../README.md)。

**现状与证据：**

- README 和项目约定引用的以下 7 份文档在基线中均不存在：`auth-backend.md`、`project-structure.md`、`code-comments.md`、`layout-migration.md`、`auth-migration.md`、`ui-conventions.md`、`custom-theme-migration.md`。
- README 的目录说明仍含 `contexts/`、旧的上下文/持久化 Hook 职责和在线状态工具描述；实际主题状态已迁至 `stores/theme-store.ts`，相应旧目录或实现已移除。
- Git 历史可找到部分被删除的迁移文档，但不能据此假定所有缺失文档都有可直接恢复的历史版本。

**影响：** 项目要求“修改前阅读对应文档”，但执行不了；新成员容易按旧状态模型开发。涉及数据库配置、初始化和测试权限的操作说明缺失，也会让正常接入流程依赖个人环境。

**最小调整建议：**

1. 恢复或重写仍需要的文档，按当前代码校正，不直接照搬历史版本。
2. README 只保留现状、运行方式和文档入口；`project-structure.md` 说明职责及依赖方向，模块文档记录行为和迁移细节。
3. 补充真实的环境配置步骤、生成命令、迁移顺序和测试数据库权限，不提交秘密。
4. 删除无效链接或补齐目标；不要让规范指向不存在的例外条款。

**验收：** 新成员能仅依靠仓库文档完成配置、生成、检查和启动；所有本地文档链接有效，目录说明与代码一致。

### A02｜第三方源码的来源与许可证记录缺失

**证据：** `b7c7638` 中存在 `docs/custom-theme-migration.md` 与 `docs/third-party/shadcn-studio-LICENSE.md`，在 `44cfac4` 中被删除；相关主题编辑组件和颜色/CSS/阴影算法仍存在。

历史记录标注的上游固定提交为 `72a20331970218848103184b61e1efa9d0e08dea`。历史许可证文本除 MIT 段落外，还含 **Commons Clause Restriction**，不能笼统描述为“没有额外限制的 MIT”。

**影响：** 后续修改、升级和分发时，难以确定代码来源及必须保留的声明；删除来源记录不改变上游许可条件。

**最小调整建议：**

- 恢复与实际迁入版本对应的完整许可证和版权信息。
- 在迁移文档中保留“上游提交 / 原文件 / 当前文件 / 必要适配”的映射，并更新改名后的路径。
- 对拟分发方式核实附加条款与原商业模板授权；本评审不作法律合规结论。

**验收：** 可以从当前文件追溯来源版本和许可；发布清单包含应随分发保留的声明。无需将整套上游仓库复制进项目。

### A03｜Web 与未来桌面的资源路径策略混在一起

**位置：** [vite.config.ts:18](../apps/web/vite.config.ts)、[main.tsx:26](../apps/web/src/main.tsx)。

**现状：** Vite 固定 `base: "./"`；HTTP 环境使用 browser history，只有 `file:` 环境使用 hash history。

**已验证的失败路径：**

1. 生产 `index.html` 的入口为 `./assets/index-….js`，CSS 和 preload 链接也是相对地址。
2. 直接打开 `/settings/general` 时，浏览器会请求 `/settings/assets/index-….js`，而非 `/assets/index-….js`。
3. 本次临时生产预览中，该错误资源地址返回 `200 text/html`，正确根资源地址返回 `200 text/javascript`。前者是 SPA fallback 的 HTML，不能作为 JavaScript 模块加载。

所以，**开发服务器能打开、站内点击能跳转、构建通过，都不能证明生产嵌套路由可以刷新。**

**建议：** 保留同一份前端源码，显式区分部署配置：Web 使用与部署位置对应的绝对 base（根部署为 `/`，子路径部署按实际前缀配置），TanStack Router 的 `basepath` 同步使用该前缀，并配置 history fallback；未来桌面若使用本地文件加载，再采用适合该方式的资源 base 与路由策略。不要为了共享源码，强行要求所有目标使用相同的资源寻址假设。

**验收：** 对构建产物直接打开和刷新 `/settings/general`、`/knowledge-base/collections`，确认入口资源状态和 MIME 正确；桌面接入时再独立验证桌面目标。仅补 fallback 不能解决错误的资源路径。

### A04｜路由生成没有纳入类型检查前置

**位置：** [.gitignore:12](../.gitignore)、[Web 脚本:10](../apps/web/package.json)、[main.tsx:18](../apps/web/src/main.tsx)、[Vite 插件:28](../apps/web/vite.config.ts)、[根脚本:41](../package.json)。

**现状：**

- `routeTree.gen.ts` 被忽略，但 `main.tsx` 必须导入它，文件路由的类型注册也依赖它。
- Web 的 `check-types` 仅执行 `tsc --noEmit`，Turborepo 没有为它设置路由生成前置。
- `postinstall` 只生成环境类型；路由生成挂在 Vite 插件上。
- 干净的隔离检出中没有路由生成物；日常工作目录已有该文件，容易掩盖问题。

**影响：** 在已安装依赖和环境类型、但未启动 Vite/构建的干净检出中，直接类型检查缺少必要输入。当前开发目录通过不能代表全新机器通过。

**建议：** 保留自动生成且不手改生成文件的策略，为路由提供可显式执行、版本匹配的生成入口，并让 `check-types` 的执行链确保该前置完成。将环境与路由两类生成物的来源、输出、执行顺序、缓存恢复责任一起写清楚；不是简单要求所有人“先打开一次开发服务器”。

**验收：** 从没有生成物和 Turbo 缓存的检出开始，按文档安装后直接执行类型检查成功；再次执行生成应稳定，不产生无意义改动。

### A05｜生成文件与手写关系定义共用覆盖目标

**位置：** [认证生成脚本](../packages/auth/package.json)、[authRelations](../packages/db/src/schema/auth.ts)、[数据库工厂](../packages/db/src/index.ts)。

**现状：** `schema:generate` 使用 `--output ../db/src/schema/auth.ts --yes`；同一文件包含为 Drizzle 1.0 维护的 `authRelations`，数据库工厂直接依赖这个导出。

**影响：** 官方生成器的覆盖边界与手工维护边界重叠。文件头写“重新生成需保留关系适配”只是在提醒人工操作，不能保证命令可重复执行。这里确认的是**覆盖风险与流程缺口**，本次没有运行命令制造丢失。

**建议：**

1. 将手写关系放到独立文件，例如 `packages/db/src/relations.ts`，让生成目标只承载明确归生成器所有的内容。
2. 核对 Better Auth 1.7.5 生成结果与 Drizzle 1.0 RC 的 API 是否匹配；若仍需转换，应提供显式、可重复的适配步骤，不依靠每次手工修补。
3. 保持 schema 的包出口稳定，不借此重新划分 auth/db 的职责。

**验收：** 连续生成两次结果稳定，手写定义不被覆盖；数据库与认证包类型检查和真实认证测试通过，再审查应产生的迁移差异。

### A06｜默认管理员初始化策略没有与生产启动隔离

**位置：** [启动入口:26](../apps/server/src/index.ts)、[管理员初始化:50](../packages/auth/src/bootstrap.ts)。

**现状：** 无论环境如何，启动都执行默认管理员初始化；目标账号不存在时以公开的 `admin / admin` 创建 `admin` 角色。生产随后监听 `0.0.0.0`。README 也公开说明了该默认凭据。

**影响：** 本地引导策略进入了生产常规启动路径；首次对外部署若没有及时更换凭据，会暴露高权限默认账号。这不是把文件从一个目录移到另一个目录就能解决的。

**建议：** 生产使用显式管理员初始化步骤，并通过安全输入提供初始凭据；若保留开发引导，必须明确限定适用环境或默认关闭的开关。保留现有的并发初始化锁、已有密码不覆盖、已有普通账号不自动提权等保护。

**验收：** 空生产数据库在常规启动时不会自动产生公开默认密码；受控初始化只能按授权执行，重复初始化不改变已有用户安全属性。

### A07｜TypeScript 工程边界和检查范围不完整

**位置：** [根 tsconfig](../tsconfig.json)、[共享配置](../packages/config/tsconfig.base.json)、[UI 配置](../packages/ui/tsconfig.json)、[Web 配置](../apps/web/tsconfig.json)。

这是两个相关但不同的问题：

**第一，根工程职责不明确。** 根配置只有 `extends`，没有 `files/include/references`，直接从根运行 `tsc` 会按默认规则收录各工作区文件，却没有对应的 JSX、DOM 和应用别名设置。本次根直接检查产生大量相关诊断。

**注意：常规 `bun run check-types` 通过 Turbo 调用各工作区配置，不是使用这个根配置。不能把前述现象描述为常规类型检查必然错误。**

**第二，检查存在空白。** `scripts/*.ts` 没有被常规工作区检查覆盖；UI 配置只收录 `src`，不包含 `packages/ui/test`。Bun 测试可以转译执行这些文件，但运行通过不等同于已经接受 TypeScript 静态检查。

**建议：**

- 明确根配置是空的工作区入口，还是专门的工具工程；不要继续让它隐式包含全仓。
- 给根工具脚本和 UI 测试配置适合各自环境的 TypeScript 工程，显式纳入常规检查。
- Web/UI 的 DOM 环境、Bun 测试与服务端环境应分别管理；不要为测试方便把所有 Bun 全局类型混入共享 UI 源码环境。
- 不必因此全仓改用 project references 或 `tsc -b`；先补齐范围和职责即可。

**验收：** 每份手写 TS/TSX 文件都能说明由哪个配置负责，检查命令实际执行这些配置，根工具不会因为落入错误工程而出现成片假诊断。

### A08｜进程入口未完成资源生命周期管理

**位置：** [数据库工厂:20](../packages/db/src/index.ts)、[服务入口:18](../apps/server/src/index.ts)。

**现状：** 工厂正确返回 `{ db, pool }`，注释也要求调用方关闭池；入口只保留 `db`，没有配套的初始化失败清理和退出关闭流程。

**影响：** 程序缺少明确的“停止接收请求 → 处理正在执行的请求 → 释放数据库连接”的责任归属，启动失败和停止行为也不够可控。

**建议：** 由 `index.ts` 或其调用的进程生命周期函数持有 `app` 与 `pool`，集中处理启动异常、终止信号和关闭；清理应幂等，并有合理超时。不要把监听、信号或 `process.exit` 副作用塞回可测试的 `app.ts` 或共享数据库包。

**验收：** 初始化失败、正常停止和连续关闭请求均能释放资源；健康检查工厂仍可独立创建和测试。

### A09｜认证错误边界还需区分输入问题与服务故障

**位置：** [认证模块 onError](../apps/server/src/modules/auth/index.ts)。

**已验证：** 发送格式错误的 JSON 到 `/api/auth/login`，当前返回 `500 AUTH_FAILED`，而不是客户端输入/解析错误。当前钩子只区分 `VALIDATION`，其余统一映射为 500。

**另一个已确认事实：** 失败日志只记录框架 `code`，没有实际异常信息。数据库或响应解析问题发生时，排查上下文不足。

**建议：** 根据 Elysia 的实际错误类别区分解析/校验、业务拒绝和内部故障；服务端记录经脱敏的异常及必要的请求关联信息，客户端继续只得到受控中文错误。不得记录密码、会话 Cookie、认证秘密或完整敏感请求体。

目前只有一个业务模块，不必立即建立庞大的全局错误框架；后续第二个模块出现重复需求时再提取公共部分，保持 hook 作用域清楚。

**验收：** 畸形 JSON、无效字段、认证失败、依赖异常分别有正确状态和稳定错误结构；内部错误可诊断但不会泄漏给客户端。

### A10｜认证集成测试有隐含执行顺序

**位置：** [共享 cookie/userId](../apps/server/test/auth.test.ts)、[注册写入测试状态](../apps/server/test/auth.test.ts)、[最后的限流用例](../apps/server/test/auth.test.ts)。

**现状：** 多个独立命名的测试使用之前注册用例生成的 Cookie/用户 ID；最后的限流测试只发起一次请求就断言 429，依赖前面请求积累的计数和时间窗口。

**影响：** 整套测试通过，不代表单独筛选、调整顺序或运行变慢时仍可靠；失败可能来自隐含前置，而不是被测行为。

**建议：** 让测试拥有明确 fixture，或者将确实需要顺序的流程组织为一个完整场景。限流用例在自己的准备阶段产生必要次数，并控制测试窗口/依赖，不能借用其他用例的请求余额。

**应保留：** 当前随机 schema、独立迁移记录和定向清理方案有实际价值；没有证据支持将它描述为必然污染业务表。补测试独立性，不要退回直接清空业务库。

**验收：** 可独立运行会话、退出和限流场景；整套与单独筛选结果一致，失败后仍可清理测试资源。

### A11｜文件头说明已出现可核实的漂移

**位置示例：** [lib/auth.ts:3](../apps/web/src/lib/auth.ts)、[types/theme.ts:6](../apps/web/src/types/theme.ts)、[架构测试文件头](../scripts/architecture.test.ts)。

**现状：**

- 已入库文件仍写“现有文件尚无 Git 创建记录”。
- 主题类型、配置和领域规则的“被调用”仍列出已经移除的 `contexts`。
- 架构测试的“调用”将字符串样例中的 `electron`、`next`、服务端越界路径也列入，容易让读者误认为它真的导入了这些模块。
- 多处“版本作用”只是重复整类文件通用说明；手工穷举调用方很容易在正常重构后过期。

**建议：** 按现有项目约定保留职责、可核实时间、版本作用、主要调用关系和预期结果，不擅自删除要求；但应补齐缺失的注释规范，明确描述的是**主要真实依赖与边界**，不要求手工维护完整导入图。清理过时陈述，把行为约束、失败条件和来源信息作为重点。

**验收：** 注释能解释代码边界，时间来源可查，没有不存在的调用方；不会用重复模板段落掩盖真正重要的限制。

### A12｜主题主面板适合局部提取编辑会话

**位置：** [theme-control-panel.tsx:79](../apps/web/src/components/theme-editor/theme-control-panel.tsx)，文件约 606 行。

**判断依据不是行数本身。** 面板同时持有来源预设、当前草稿、基准草稿、模式、无效字段、输入重建版本、预览生命周期及保存/导入/删除操作。多个入口需要同时执行“替换草稿、清空错误、重建输入”等相关状态转换。

**影响：** 未来新增编辑操作时，容易遗漏成组状态更新；开发者需要跨过大段 JSX 才能确认一次操作的完整语义。

**建议：**

- 优先提取局部 `useThemeEditSession` 或小型 reducer，统一来源切换、还原、导入、更新、校验状态和预览清理。
- `ThemeControlPanel` 继续承担已有表单组合；对话框只有在职责确实独立时再拆。
- 不把所有未保存草稿搬进全局 Store，不重写现有 DOM/控件组合，不复制已有 CSS 解析、校验和导出算法。
- `theme-presets.ts` 虽然更长，但主要是静态数据，不能用同一行数标准要求拆成几十个文件。

**验收：** 行为不变，编辑会话转换可单独阅读和验证；取消、保存失败、切换主题、导入和外部同步仍保持原有状态边界，并做相关浏览器回归。

### A13｜工具层存在反向环境耦合，缓存范围较宽

**位置：** [数据库环境定义:10](../packages/db/.env.schema)、[Turbo 全局环境:47](../turbo.json)。

**现状：** 数据库工具从 `apps/server` 导入环境定义；根 Turbo 又将认证秘密、API 地址等及各工作区 `.env*` 都放入全局范围。

**需要准确区分：** 这不是数据库运行时代码反向依赖 Web/Server，也没有因此形成 JS 模块循环；它是**工具配置**对应用目录和部署上下文的依赖。

**取舍与建议：**

- 当前只有一个服务端，复用配置减少了重复，可暂时保留，但要写清依赖。
- 当数据库工具需要独立执行、裁剪部署或增加第二个服务端时，优先让公共环境契约位于中立位置，或由各工具校验注入的同一个连接值，而非要求基础包知道某个应用目录。
- 全局环境/文件影响所有任务缓存，安全但偏粗。只在需要优化时拆分任务级依赖，并保留 Varlock 的真实读取路径，不能为了缓存命中率漏掉构建输入。

**验收：** 数据库工具的配置来源明确；相关环境变化能使正确任务失效，无关应用变化不必影响所有任务。无需为此立即新建一个大型环境管理包。

### A14｜质量检查需要形成可重复的门禁

**位置：** [根 scripts](../package.json)、[turbo.json](../turbo.json)。

**现状：** 已有 lint、类型检查、构建、UI、API、架构测试，这是基础优势；但没有统一的只读验证入口，`check` 实际会执行 `biome check --write`。仓库中未发现 CI 配置；这不排除存在仓库之外的托管平台配置。

**影响：** 执行哪些检查、是否命中旧缓存、是否先生成类型，仍依赖操作者记忆。文档缺失会进一步扩大差异。

**建议：**

- 清楚区分只读检查与自动修复入口，不让 CI 误调用写入型 `check`。
- 统一必要的生成、lint、类型检查、单元/架构测试和构建步骤；真实数据库测试单独准备隔离环境。
- 增加干净检出的执行验证和生产深层地址 smoke check，避免只依赖当前工作目录。
- 不要求所有任务必须搬进 Turbo：根 Biome 是合理做法；涉及真实数据库的测试也不能直接视作可缓存的纯任务。

**验收：** 使用锁文件的干净安装可以重复跑完整门禁；失败能够定位到具体阶段，流程不依赖开发者机器残留的生成物。

## 五、建议保持的目录规范

下面是基线评审的**增量调整方向**；当前目录职责以 [项目结构](./project-structure.md) 为准。未列出的现有子目录继续保留。

```text
apps/
  web/
    src/
      main.tsx
      routes/                       # 路由、参数、加载、访问前置与页面挂载
      views/<feature>/              # 页面及该页面专用子组件/表单规则
      components/
        layout/                     # 应用壳、导航、跨路由宿主
        auth/                       # 登录/注册共用展示组件
        theme-editor/               # 主题编辑 UI 与局部编辑会话
      stores/                       # 确实需要跨组件共享的状态
      hooks/                        # 跨功能可复用的 React 行为
      configs/                      # 静态选项、默认值、目录数据
      lib/                          # 应用级接口适配、领域规则、编解码
      utils/                        # 按领域组织的纯计算及明确命名的适配函数
      types/                        # 多处共享的类型；局部类型仍放在所属模块
      assets/
      styles/
    test/
  server/
    src/
      app.ts                        # 无监听、无环境加载的装配工厂
      index.ts                      # 进程启动、资源所有权与关闭
      modules/<feature>/
        index.ts                    # Elysia HTTP 边界
        model.ts                    # 输入/输出运行时契约及派生类型
        service.ts                  # 该功能逻辑或请求级绑定，按实际需要采用
        ...                         # 仅在有独立职责时增加适配文件
    test/
packages/
  ui/src/{components,lib,styles}/
  auth/src/                         # 认证库配置、工厂、受控初始化工具
  db/src/
    schema/                         # 表定义；明确区分生成与手工维护
    relations.ts                    # 可选：从生成目标移出的手写关系
    migrations/
    index.ts                        # 连接工厂
  config/                           # 共享 TS 基础规则，明确运行环境覆盖
scripts/                            # 仓库级检查和必要生成工具
  ...
docs/                               # 当前有效的规范、模块记录和第三方声明
```

### 5.1 统一的是责任，不是强迫所有代码长得一样

- 应用组件默认导出、共享复合 UI 组件命名导出、TanStack 路由导出 `Route`，可以同时存在；它们服务于不同用途。
- 单个表单专用类型放在表单旁，比为每个 Props 都建立全局类型文件更容易阅读。
- `lib` 与 `utils` 的名称没有框架级强制定义。目前关键是文档明确职责，新代码有一致归属；不值得为现有主题代码做一次全量搬迁。
- `assets/data/navigation.ts` 等沿用迁移来源并有清楚职责，不是错误。若日后成为带权限、动态路由或服务数据的配置，再调整归属，不必现在机械移到 `configs`。
- 新业务继续进入 `views/<feature>` 与 `modules/<feature>`；不要提前建立空的 repository、use-case、domain、infrastructure 等多层模板。

### 5.2 依赖方向

1. Web 的运行时依赖 UI 和客户端库；服务端契约只通过 `import type` 使用。
2. Server 负责装配 auth/db，并持有进程资源；auth 依赖 db，db 不应依赖应用运行时代码。
3. UI 不应导入 Web 的路由、账号或业务 Store。
4. 共享 CSS 中为 Tailwind 配置扫描路径，和运行时导入应用逻辑不是同一种依赖，不能混为一谈。
5. 跨包访问继续经过 `exports`，不要新增绕过公开出口的深层路径；当前不需要新建一套重复的 API 契约包。

## 六、暂时不建议做的调整

1. **不整体迁入 FSD、DDD、Clean Architecture 或另一套 React 模板。** 当前主要业务页还未迁入，抽象成本会先于收益出现。
2. **不将服务端拆成全局 controller/service/model 大目录。** 当前按功能聚合更便于演进。
3. **不因为文件长就拆分静态配置和成熟的基础组件。** 优先看变化原因与状态复杂度，而不是设机械行数上限。
4. **不删除 `next-themes` 只因为名字含 next。** 它不是 Next.js 路由/服务端运行时；应检查真实依赖和行为，而非名称。
5. **不强制前后端只用同一种校验库。** 前端 Zod 负责中文表单交互，服务端模型负责不可信请求；边界不同可以合理并存。共享规则变化时补契约回归，避免漂移，不能从浏览器运行时直接导入服务端模块。
6. **不因 UI 包目前把 React 放在 dependencies 就断言存在重复 React 故障。** 当前是私有、统一版本的内部工作区。若以后独立发布给外部消费者，再系统审查 peerDependencies 与发布构建。
7. **不提前实现桌面壳或桌面鉴权。** `file:` hash 路由只是路由准备，不代表 Cookie、Origin、CORS 和打包全部兼容；这些需要在桌面阶段专门验证，也不能简单放行所有 `null` Origin。
8. **不把授权留白页面报成业务缺失。** 包括知识库、设置及找回密码等当前预留出口。

### 知识库未来迁移时的一条具体提醒

[知识库父路由](../apps/web/src/routes/_workspace/knowledge-base.tsx) 明确设置 `component: () => null`，而 `knowledge-base.collections.tsx` 会成为它的子路由。**以后迁入 collections 内容时，父路由必须提供 `Outlet` 或采用对应的布局/首页划分**，否则子页面没有渲染出口。

当前父子都按范围留白，因此这里是未来集成提醒，不是要求现在补业务页的缺陷。

## 七、推荐实施顺序与停止边界

本节保留建议的实施分组；已完成项目见文首实施记录。

### 第一批：不改变页面交互的工程修正

- A06：对外部署前先移除普通启动中的默认管理员创建，改用显式初始化。
- A01/A02：补齐启动所必需的文档、来源与许可证记录；普通 README 描述修订按 P2 处理。
- A03：分清 Web 构建资源 base 和未来桌面目标。
- A04/A05：补齐路由生成前置，隔离认证生成目标与手写定义。
- A07：补齐工具与测试类型检查，明确根 TS 工程职责。

**停止边界：** 不借这批任务重写 UI、不引入新状态库、不大规模移动文件。

### 第二批：服务运行与验证稳定性

- A08：进程资源关闭流程。
- A09/A10：错误分类、脱敏诊断及集成测试独立性。
- A14：把上述检查固化为可重复的门禁。

**停止边界：** 不新增无关业务接口、不替换已有认证库、不重写数据库隔离方案。

### 第三批：随主题功能变化做局部整理

- A11：校正涉及文件的过期注释。
- A12：提取编辑会话，保留现有样式和交互。
- A13：只有在独立部署或缓存成本显著时再处理配置耦合。

每批独立验证、独立审阅；不要把工程修复、主题交互重构、数据库行为改变混成一个大提交。

## 八、本次实际验证结果

以下是本次连续评审过程中已经执行的结果，不是文档建议中的未来验收。

| 验证 | 结果与限制 |
| --- | --- |
| `bun run lint` | 通过；Biome 检查 154 个文件，没有自动修复，UI 规则通过。 |
| `bun run check-types` | 5 个实际工作区检查任务成功，全部命中 Turbo 缓存；不能据此证明干净检出后的生成顺序正确。 |
| Web 目录直接 `tsc --noEmit -p .` | 通过，绕过 Turbo 缓存；仍使用该目录已有的生成物。 |
| 根目录直接 `tsc --noEmit -p tsconfig.json` | 失败，当前环境统计 995 条 TS 诊断，主要涉及 JSX/别名等工程范围问题；它不是项目声明的常规检查入口。 |
| 根目录 `bunx turbo run build --force` | Server、Web 两个生产构建通过，0 个缓存命中。 |
| `bun run test:ui` | 共 27 项通过：根规则/UI 包 6 项，Web 21 项。 |
| `bun run test:architecture` | 13 项通过。 |
| `bun run test:api` | 11 项通过，使用真实 PostgreSQL 的随机隔离 schema；输出包含预期错误密码场景的 Better Auth 警告。 |
| 构建产物深层路径探测 | 确认嵌套地址会解析出错误的资源路径；临时预览返回了 HTML 而非 JavaScript，见 A03。临时预览已停止。 |
| 畸形 JSON 探测 | 确认 `/api/auth/login` 返回 500，见 A09；临时探测文件已清理。 |

验证过程中也有工具调用失败：一次在 Web 工作目录将 `--force` 传给 `vite build`，得到 `Unknown option --force`，之后改为根 Turbo 的强制构建并成功；另一次尝试使用本机不存在的 `timeout` 命令，没有执行目标检查，随后改为直接运行 TypeScript。这些是检查操作的失败，**不作为项目缺陷**。

**未验证的部分：** 真正的全新安装到部署全过程、认证 schema 再生成、完整浏览器键盘/缩放/小窗口/持久化回归、Electron 和生产网络拓扑。不能把现有测试全部通过解释为这些场景已经通过。

## 九、官方依据与进一步阅读

以下资料用于判断原则和惯例；具体版本行为以当前锁文件、安装包和本次验证为准。

1. [Elysia — Best Practice](https://elysiajs.com/essential/best-practice.html)：按功能分组、Elysia controller、请求相关服务与普通服务、模型及类型推导。
2. [React — Build a React App from Scratch](https://react.dev/learn/build-a-react-app-from-scratch)：Vite 等构建工具、客户端 SPA、独立选择路由和数据方案；不是强制目录模板。
3. [React — Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)：纯渲染、状态所有权和副作用边界。
4. [TanStack Router — File Naming Conventions](https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions)：根路由、目录 route、index、点号嵌套与无路径布局。
5. [TanStack Router — Outlets](https://tanstack.com/router/latest/docs/framework/react/guide/outlets)：自定义父组件渲染子路由的出口。
6. [TanStack Router — Authenticated Routes](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes)：父级 `beforeLoad`、路由上下文及认证组织。前端路由守卫不能替代服务端授权。
7. [Vite — Building for Production](https://vite.dev/guide/build.html)：公共 base 与相对资源路径。
8. [Vite — Deploying a Static Site](https://vite.dev/guide/static-deploy)：`dist`、预览与部署、托管路径及 SPA rewrite 示例。
9. [shadcn/ui — Monorepo](https://ui.shadcn.com/docs/monorepo)：应用与共享 UI 工作区、配置别名和包出口。
10. Turborepo 2.11.7 本机随包文档：`node_modules/turbo/docs/README.md`，以及 `crafting-your-repository/structuring-a-repository.mdx`、`configuring-tasks.mdx`、`using-environment-variables.mdx`、`core-concepts/internal-packages.mdx`、`guides/tools/typescript.mdx`、`guides/tools/biome.mdx`。

---

**最终判断：项目已经有一套可继续演进的结构。先补齐可复现性、文档与运行边界，比重新命名目录或套用大型架构更有价值。**
