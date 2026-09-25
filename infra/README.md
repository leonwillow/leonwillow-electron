# 基础设施

这里存放服务部署和交付配置，不属于运行时共享代码包。当前只预留目录，没有启动容器或创建外部资源。

| 目录 | 职责 |
| --- | --- |
| `docker/postgres/` | 本地 PostgreSQL 的容器配置与初始化支持 |
| `docker/redis/` | 本地 Redis 的容器和持久化配置 |
| `deploy/web/` | Nuxt SPA 静态托管、路由回退及 API 反向代理 |
| `deploy/api/` | Bun / Elysia 服务部署、探针与运行配置 |
| `deploy/desktop/` | Electron 分发、签名和更新相关的交付配置 |

本地 Compose 清单在接入服务时放入 `docker/`，镜像版本与数据卷同时明确。PostgreSQL 的业务 schema 迁移仍由 `apps/server/drizzle` 管理，不放入容器初始化脚本重复维护。

密钥通过应用环境或部署密钥服务提供，不提交进配置。桌面打包工具配置属于 `apps/desktop`；这里仅承载分发环境的交付配置。
