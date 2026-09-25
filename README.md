# 综合工作平台

基于 Nuxt SPA、Nuxt UI、Electron 和 Elysia 的单组织 RBAC 工作平台。浏览器与桌面端共用前端，连接统一部署的 Bun / Elysia 后端。

当前阶段：**最小可运行基础**。Nuxt SPA、Elysia/Bun 与 Electron 已接入；唯一功能是测试页面调用 `GET /test`，返回 `{"message":"test"}`。已建立 6 个 workspace，其余业务目录仍用 `.gitkeep` 占位。鉴权、RBAC、数据库、Redis 和审计尚未实现。

## 从这里看项目

```text
.
├── apps/                              应用入口
│   ├── web/                           Nuxt SPA，浏览器与桌面共用的业务界面
│   │   ├── app/
│   │   │   ├── app.vue                Nuxt UI 根组件与页面出口
│   │   │   ├── assets/css/             Tailwind CSS / Nuxt UI 样式
│   │   │   ├── components/             公共组件及业务组件
│   │   │   ├── composables/            前端状态和交互逻辑
│   │   │   ├── layouts/                登录布局、工作平台布局
│   │   │   ├── middleware/             登录与页面权限检查
│   │   │   ├── pages/
│   │   │   │   ├── index.vue          唯一已实现页面：test
│   │   │   │   ├── auth/               登录及身份验证
│   │   │   │   ├── workspace/          工作台
│   │   │   │   ├── system/
│   │   │   │   │   ├── users/          用户管理
│   │   │   │   │   ├── roles/          角色及授权管理
│   │   │   │   │   ├── resources/      M/C/F 资源与菜单管理
│   │   │   │   │   └── departments/    部门管理
│   │   │   │   └── monitor/
│   │   │   │       ├── sessions/       在线会话
│   │   │   │       └── audit/          审计记录
│   │   │   ├── plugins/                客户端初始化与 Nuxt 注入
│   │   │   └── types/                  仅前端使用的类型
│   │   ├── public/                     无需编译的静态资源
│   │   └── nuxt.config.ts              SPA、Nuxt UI 与公开 API 地址
│   ├── desktop/                       Electron 桌面宿主
│   │   ├── src/main/                  窗口、生命周期和系统能力
│   │   ├── src/preload/               向渲染进程暴露受控能力
│   │   ├── src/ipc/                   IPC 通道与校验
│   │   └── resources/                 应用图标及打包资源
│   └── server/                        Elysia 后端应用，运行于 Bun
│       ├── src/
│       │   ├── index.ts               启动入口
│       │   ├── app.ts                 应用定义
│       │   ├── types.ts               Eden 使用的类型出口
│       │   ├── bootstrap/             依赖装配、启动与关闭
│       │   ├── config/                服务端环境配置
│       │   ├── modules/               test 已实现；auth、system 等仍占位
│       │   ├── authorization/         权限检查、数据范围、授权快照
│       │   ├── infrastructure/        xlt-token、Drizzle、Redis 接入
│       │   ├── plugins/               Elysia macro / 插件
│       │   └── shared/                后端内部的错误、日志和分页工具
│       ├── drizzle/migrations/        数据库迁移
│       ├── drizzle/seeds/             初始化数据
│       └── tests/                     后端单元与集成测试
├── packages/                          共享代码与配置
│   ├── api-client/                    独立于 UI 框架的 Eden + Alova 请求封装
│   │   └── src/
│   │       ├── index.ts               创建客户端，目前只提供 test 请求
│   │       ├── adapters/              Alova → Eden 适配
│   │       ├── requests/              业务请求工厂（占位）
│   │       ├── cache/                 缓存身份与失效（占位）
│   │       └── errors/                统一错误类型（占位）
│   ├── access-contract/               前后端共用的授权词汇
│   │   └── src/
│   │       ├── permissions/           权限标识
│   │       ├── resources/             资源类型与清单契约
│   │       └── data-scope/            数据范围枚举与类型
│   └── config/typescript/             共享 TypeScript 编译约定
├── infra/
│   ├── docker/                        本地 PostgreSQL / Redis
│   └── deploy/                        Web、API、桌面端的交付配置
├── docs/                              设计文档与后续决策记录
├── tests/e2e/                         跨应用端到端用例
├── CONTEXT.md                         领域词汇
├── package.json                       Bun Workspaces 与根任务入口
├── turbo.json                         Turborepo 任务与依赖调度
└── bun.lock                           工具依赖锁定
```

## 每个包负责什么

| Workspace | 职责 | 边界 |
| --- | --- | --- |
| `@platform/web` | Nuxt 页面、交互及客户端初始化 | SPA；不建立 Nuxt 服务端业务目录 |
| `@platform/desktop` | Electron 桌面能力 | 复用 Web 静态产物，不复制业务页面 |
| `@platform/server` | 完整 Elysia 后端 | 业务、鉴权、数据访问与 Bun 运行入口 |
| `@platform/api-client` | Eden + Alova 请求封装 | 不依赖 Vue、Nuxt 或 React，由应用传入状态适配器 |
| `@platform/access-contract` | 权限标识与授权公共类型 | 不包含数据库模型、密钥或服务端逻辑 |
| `@platform/config` | 开发配置 | 当前提供共享 TypeScript 基础配置 |

后端代码集中在 `apps/server`。`app.ts` 定义应用，`index.ts` 负责运行，`types.ts` 提供 Eden 所需的类型出口；这些职责通过应用内分文件区分。当前只有一个后端，不为共享类型而把整个后端拆成库。

前端页面和交互集中在 `apps/web`，请求封装位于 `packages/api-client`，用于在更换前端框架时保留接口调用代码。浏览器与 Electron 仍共用同一份前端。Nuxt 插件负责读取 API 地址、传入 `VueHook` 并注入客户端；公共请求包不导入 UI 框架，不处理路由或消息提示。

前端的 `app/pages`、`layouts`、`components` 等遵循 Nuxt 4 的特殊目录约定。后端业务模块按 Elysia 推荐的 `index.ts / service.ts / model.ts` 组织，数据访问文件按需增加。`api-client`、`authorization`、`infrastructure` 等是项目自定义分工；框架不会仅凭这些目录名自动注册功能。核对依据与待初始化项见[框架约定与审查结论](docs/framework-conventions.md)。

依赖方向：

```text
web ──→ access-contract
 └──→ api-client ── 类型依赖 ──→ server ──→ access-contract
desktop ── 打包时使用 web 的静态产物
```

每个包只通过已声明的 workspace 名称访问其他包，不通过相对路径跨包读取源码。`api-client` 对 `server` 的依赖仅用于 Eden 类型，使用 `@platform/server/types` 类型出口；浏览器不运行时导入后端代码。请求包直接导出 TypeScript 源码，由前端构建工具编译，无需单独启动构建监听。

## 按功能找目录

| 功能 | 页面位置（`apps/web/app/pages/` 下） | 后端位置（`apps/server/src/modules/` 下） |
| --- | --- | --- |
| 登录、退出、当前用户 | `auth/` | `auth/` |
| 用户及角色绑定 | `system/users/` | `system/users/` |
| 角色、资源授予、数据范围 | `system/roles/` | `system/roles/` |
| 目录、页面、操作资源 | `system/resources/` | `system/resources/` |
| 部门结构 | `system/departments/` | `system/departments/` |
| 在线设备、会话与下线 | `monitor/sessions/` | `sessions/` |
| 登录与操作审计 | `monitor/audit/` | `audit/` |

工作台 `workspace/` 后续组合已有业务接口，不预先创建没有业务内容的后端工作台模块。前端导航可以分组，后端仍按业务模块组织。

## 运行

使用 Bun 1.3.14 和受 Nuxt 支持的 Node.js（本地验证为 24.19.0）。Bun 管理依赖、调度任务并运行后端；Nuxt 工具与 Electron 主进程使用各自的 Node.js 环境。

```sh
bun install --frozen-lockfile
bun run dev
```

打开 <http://127.0.0.1:3000>，点击“测试连接”。后端接口是 <http://127.0.0.1:3001/test>。默认地址已配置，无需复制 `.env` 即可运行；自定义值见各应用的 `.env.example`。

保持前后端运行，在另一个终端打开 Electron：

```sh
bun run dev:desktop
```

首次启动 Electron 时，官方 CLI 会下载对应平台的二进制。开发窗口加载同一个 Nuxt 开发地址，没有独立的桌面页面或本机业务后端。

## 检查与构建

```sh
bun run typecheck
bun run build
```

`typecheck` 检查 Web、server、desktop、api-client、access-contract；Web 使用 `nuxt typecheck`。安装后的根 `postinstall` 通过 Turbo 执行 Web 的 `nuxt prepare`。TypeScript 暂统一锁定为 6.0.3：本轮实测 `vue-tsc` 3.3.11 无法使用 TypeScript 7 的 `lib/tsc` 入口。

构建产物：

| 应用 | 产物 | 运行方式 |
| --- | --- | --- |
| Web | `apps/web/.output/public` | 静态托管；本地可用 `bun run --cwd apps/web preview` |
| Server | `apps/server/dist/index.js` | `bun run --cwd apps/server start` |
| Desktop | `apps/desktop/dist/main` 与 `dist/renderer` | 保持后端运行，执行 `bun run --cwd apps/desktop start` |

桌面构建由 Turbo 等待 Web 构建完成后复制静态产物，通过 `app://platform` 加载，不依赖 Nuxt 开发服务器。当前输出为本地可运行目录，尚未制作安装包。

静态构建中的 `NUXT_PUBLIC_API_BASE_URL` 在构建时确定；更换后端地址后重新构建。当前测试请求关闭响应缓存，确保每次点击都实际请求后端；Alova 负责请求状态，Eden 执行网络调用。

`turbo.json` 中的 `check-dependencies` 是无脚本的依赖传递节点，用来让上游包修改影响下游类型检查的缓存；它不是额外的业务检查。具体任务放在所属包，根脚本只委托 `turbo run`。

## 继续阅读

- [前端目录说明](apps/web/README.md)
- [桌面端目录说明](apps/desktop/README.md)
- [后端目录说明](apps/server/README.md)
- [公共请求客户端说明](packages/api-client/README.md)
- [基础设施说明](infra/README.md)
- [设计文档索引](docs/README.md)
- [框架约定与审查结论](docs/framework-conventions.md)
- [领域词汇](CONTEXT.md)
