# 后端基础设施适配

| 目录 | 技术与职责 |
| --- | --- |
| `auth/` | xlt-token Core 实例、HttpContext 适配、Redis Store |
| `database/` | Drizzle 与 PostgreSQL 连接，`schema/` 保存表和关系 |
| `redis/` | Redis 客户端、连接生命周期和底层操作 |

实现通过显式配置或依赖创建，生命周期由 `apps/server` 管理。这里不在导入时连接外部服务，也不包含前端可读取的秘密配置。

数据库迁移与种子数据分别放在本包 `drizzle/migrations/`、`drizzle/seeds/`。当前没有连接实现、数据库 schema 或迁移任务。
