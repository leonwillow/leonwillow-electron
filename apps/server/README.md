# Elysia 后端

包名：`@platform/server`。独立运行的 Elysia/Bun 后端。当前唯一接口为 `GET /test`，响应 `{"message":"test"}`；授权、数据访问及其他业务目录仍占位。

```text
src/
├── index.ts                  读取监听地址和 CORS 配置，启动 Bun 服务
├── app.ts                    createApp：注册 CORS 与 test 模块
├── types.ts                  导出 ReturnType<typeof createApp> 供 Eden 使用
├── config/                   环境变量读取、校验及配置对象
├── bootstrap/                依赖装配、启动与关闭
├── modules/
│   ├── test/                 唯一已实现模块：index.ts 与 model.ts
│   ├── auth/                 登录、退出、当前用户
│   ├── system/
│   │   ├── users/            用户及角色绑定
│   │   ├── roles/            角色、资源授权和数据范围配置
│   │   ├── resources/        M/C/F 资源与菜单树
│   │   └── departments/      部门树
│   ├── sessions/             在线会话、设备与下线
│   └── audit/                审计记录与查询
├── authorization/
│   ├── permissions/          当前主体的操作权限检查
│   ├── data-scope/           数据范围解释与查询条件构造
│   └── snapshots/            授权快照、版本检查与失效
├── infrastructure/
│   ├── auth/                 xlt-token Core / Redis Store 接入
│   ├── database/schema/      Drizzle 表结构和关系
│   └── redis/                Redis 客户端与连接管理
├── plugins/                  Elysia macro、上下文、错误映射
└── shared/
    ├── errors/               后端错误类型
    ├── logging/              日志设施
    └── pagination/           分页等服务端公共约定
drizzle/
├── migrations/               数据库版本迁移
└── seeds/                    初始资源等数据
tests/
├── unit/                     领域规则与独立模块
└── integration/              HTTP、数据库、Redis 等集成边界
```

业务模块采用 Elysia 官方推荐的功能组织方式：`index.ts` 放 Elysia 路由实例，`service.ts` 放业务逻辑，`model.ts` 放请求/响应校验模型及其推导类型。具体约定见 [modules/README.md](src/modules/README.md)。test 仅返回固定响应，无业务逻辑和数据访问，因此不建立 service / repository。

`repository.ts` 是本项目为集中数据访问和数据权限而选择的补充，不是 Elysia 强制层级；只有模块需要查询或写入时才建立。`authorization/`、`infrastructure/`、`bootstrap/`、`shared/` 也属于项目分工，不是 Elysia 的特殊目录。框架不会自动扫描这些目录，模块与插件必须显式注册。[官方 Best Practice](https://elysiajs.com/essential/best-practice)

认证接入与业务授权分开：`infrastructure/auth` 调用 xlt-token；`authorization` 解释本平台的角色、权限和数据范围；`modules/auth` 提供认证业务接口；`plugins` 将这些能力接到 Elysia 请求生命周期。

应用定义与运行入口在同一个应用内分文件：`app.ts` 接收允许的来源列表并定义应用，`index.ts` 负责实际启动。应用工厂保留完整链式调用推导，`types.ts` 仅导出由工厂返回值推导的类型。

`@platform/server/types` 是只有 `types` 条件的导出，供 `@platform/api-client` 使用 `import type { App }`。请求包在开发依赖中声明该后端应用，以获得类型和任务依赖信息，不导入后端运行时代码。Web 通过请求包消费接口，无需直接声明后端依赖。

Drizzle schema 与 Redis 客户端只存在于服务端。公共权限名称来自 `@platform/access-contract`，不把数据库实体整体导出给前端。

在本应用目录执行 `bun run dev` 启动开发服务；`bun run build` 生成 `dist/index.js`，`bun run start` 运行构建产物。默认监听 `127.0.0.1:3001`，环境变量 `HOST`、`PORT`、`CORS_ORIGINS` 可覆盖默认值，示例见 `.env.example`。Bun 从本应用目录读取 `.env`。

已安装 Elysia、CORS 插件和 Bun 类型。xlt-token、Redis、Drizzle 与 PostgreSQL 在对应业务阶段接入；当前启动不需要这些基础设施。

本次目录审查、Nuxt 与 Elysia 的官方依据，以及尚待初始化的项目见[框架约定与审查结论](../../docs/framework-conventions.md)。
