# 后端认证与部署

维护日期：2026-10-05。Elysia 暴露受控接口，Eden 消费类型；Better Auth 管理密码哈希、会话和数据库限流。

## 本地配置与数据库

在 `apps/server/.env` 设置 `DATABASE_URL` 和至少 32 字符的随机 `BETTER_AUTH_SECRET`。开发数据库由 `bun run db:start` 启动，连接地址按 `packages/db/docker-compose.yml` 配置。`.env` 不入库，不把生产连接放进测试命令。

`CORS_ORIGIN` 是逗号分隔的明确前端 Origin；`BETTER_AUTH_URL` 是客户端实际访问的 API 地址；Web 的 `VITE_SERVER_URL` 是构建时公开地址。改端口或域名时同步配置。生产显式设置 `NODE_ENV=production`，通过 HTTPS 对外服务。当前 Cookie 使用 SameSite=Lax；生产拓扑以同站点部署为前提，独立站点和第三方 Cookie 场景尚未验证。

```sh
bun install --frozen-lockfile
bun run db:start
bun run db:migrate
bun run dev
```

迁移脚本只在显式 `db:migrate` 时执行。已有数据库先备份并审查 `packages/db/src/migrations`；不要通过删除迁移记录、重建数据库或 `db:push` 强行覆盖历史差异。

服务端开发使用 `bun run --watch`，修改文件后重新启动进程，让共用认证、数据库和信号处理器随进程重新初始化，避免软热更新残留旧连接。Web 继续使用 Vite 热更新。[Bun 官方说明](https://bun.sh/docs/runtime/watch-mode) 区分了 `--watch` 的进程重启和 `--hot` 的进程内重载。

`index.ts` 创建 auth/db 后统一绑定到 `server-resources.ts`，再调用无参 `createApp()`。业务模块直接注册 Elysia 实例，在需要时读取共享资源；不会逐层传递固定依赖。资源只能绑定一次，停止接收并排空请求后解绑、关闭 pool。用户、Cookie 和事务仅属于当前请求，不进入共享资源。

## 管理员初始化

普通 dev/start 不创建管理员。仅受控终端或部署任务执行 `bun run auth:init`，并通过环境安全注入 `ADMIN_INITIAL_PASSWORD`（8～128 字符）。不要把密码写进命令参数、Git、CI 日志或 shell 历史。

本地 zsh 可以使用隐藏输入，值只保留在当前 shell 中：

```sh
read -rs 'ADMIN_INITIAL_PASSWORD?初始管理员密码：'
export ADMIN_INITIAL_PASSWORD
bun run auth:init
unset ADMIN_INITIAL_PASSWORD
```

此命令创建 `admin`，使用原有并发初始化锁；已有完整管理员不会被重置，同名普通账号不会被提权。命令不监听端口，成功和失败均关闭 pool。部署产物中的等效命令是在服务工作目录运行 `bun dist/init-admin.mjs`。现有账号密码不会因本次代码调整自动改变；原环境若曾用公开默认密码，需要由管理员更换后再对外开放。

## 代理、Cookie 与错误

- 默认限流地址来自监听器，客户端伪造的私有 IP 头会被丢弃。
- `TRUSTED_PROXY_IPS` 只接受逗号分隔的明确直接代理 IP，不接受 CIDR 或主机名；默认空。只有匹配的对端可以提供单值 `X-Real-IP`。代理必须覆盖客户端原头，源站须限制直连；缺失/无效代理头回退到对端地址，不信任任意 X-Forwarded-For 链。
- 上线时验证两个真实客户端经代理具有独立限流计数，伪造头无效，登录/刷新/退出的 Cookie 在浏览器中有效。Bun 手动转交 Cookie 的测试不能替代浏览器验收。
- 畸形 JSON 为 400，输入校验为 422，凭据拒绝为 401，限流为 429，缺少认证实例为 503，内部故障为 500。客户端只接收公开中文消息。
- 内部错误日志记录 request ID、框架类别、异常类型和栈帧；不输出完整异常消息、请求体、密码、Cookie 或签名密钥。响应携带 `X-Request-ID` 供日志关联。
- SIGINT/SIGTERM 先停止接收请求并等待正在执行的请求，再关闭 pool；整个过程限时 10 秒，超时强制停止并以非零状态退出。启动装配失败也关闭 pool。

## 人员与功能权限

系统只有 `admin`（管理员）和 `user`（普通人员）两种身份。`packages/access` 登记当前六个入口的稳定标识、名称、路径与启用状态；未知地址默认拒绝。管理员拥有全部已启用功能；普通人员只拥有 `user_module_access` 中显式授予的功能。新普通账号默认无授权，既有普通账号也不会在迁移时被自动授权。

公开注册在两层关闭：`POST /api/auth/register` 返回 403，Better Auth 设置 `emailAndPassword.disableSignUp=true`；认证库内部管理端点没有挂载到 HTTP。账号由管理员创建，内部邮箱仅用于认证适配，不展示或发送邮件。

| 接口 | 权限与作用 |
| --- | --- |
| `GET /api/access` | 有效会话；返回公开身份和当前授权，不返回 session ID/token |
| `GET /api/access/modules/:moduleId` | 检查功能访问；未知、停用或未授权功能为 403 |
| `GET/POST /api/admin/users` | 管理员；人员列表、创建账号与授权 |
| `PATCH /api/admin/users/:userId` | 管理员；更新姓名、身份、停用状态及整份授权 |
| `POST /api/admin/users/:userId/password` | 管理员；重置密码并撤销全部会话 |
| `GET /api/admin/audit` | 管理员；最近 100 条操作与前后状态 |

受保护 API 直接 `.use(accessPlugin)`，插件位于 `modules/access/plugin.ts`，通过 `access` 宏声明 `session`、`admin` 或功能 ID。插件处理 HTTP 会话和 Cookie；`modules/access/service.ts` 的普通函数负责身份、授权和功能规则，人员管理服务只引用这些普通函数与类型。每次请求从数据库读取会话和授权，禁用 Cookie 资料缓存，拒绝停用账号。权限检查失败也转交会话清除或更新的 Cookie。前端隐藏入口不能替代后端宏。健康检查没有该依赖；共享 auth/db 未初始化时权限接口返回 503。

认证接口直接在 `modules/auth/index.ts` 调用 HTTP 与响应适配函数，登录、会话、退出不再经过 `authClient` 宏。真实客户端地址仍按受信代理规则解析；登录继续经过 Better Auth handler 的密码校验和数据库限流。

管理写入必须来自白名单 Origin。账号创建、密码更新继续调用 Better Auth，认证适配器绑定当前 Drizzle 事务；账号、功能授权、会话撤销和 `access_audit` 一起提交或回滚。管理变更共用 PostgreSQL 事务锁，获得锁后重新验证操作人的会话和管理员身份。不能停用或降级当前管理员，至少保留一位有效管理员。没有人员删除接口。

撤销功能后，旧 Cookie 的下一次相关 API 请求即被拒绝。停用账号、变更身份或重置密码撤销全部旧会话；重新启用不恢复旧会话。已加载内容不会远程消失，前端在导航、刷新及回到窗口时重读权限。业务 API 必须使用同一访问宏，并在业务查询中实现数据规则；当前尚无业务数据查询，本次未引入部门、租户、数据行策略或独立动作权限。

审计包含操作者、目标、时间、动作及姓名/身份/停用状态/功能授权的前后快照；不保存密码、密码哈希或会话令牌。UI 显示最近 100 条，数据库保留全部记录。

### 本地迁移核对（2026-10-04）

本地数据库已有认证表而迁移历史为空。已在临时 schema 执行前两份认证迁移，比较现有表的列类型、空值约束、默认值、主键/唯一键/外键及索引，结构一致后在事务中补记两份已存在的迁移，再执行 `access-management` 迁移。未重建认证表或改动已有账号。其他环境若缺失历史也应先核对结构，不能直接补记未经验证的迁移。

## 生成与测试

`bun run auth:schema` 使用锁定的 auth CLI，在临时目录生成表定义，经 AST 适配移除旧 `relations()`，再覆盖 `schema/auth.ts`。手写 Drizzle 1.0 关系位于 `packages/db/src/relations.ts`；发现生成器结构变化时中止，要求审查。命令不连接数据库、不执行迁移。

`bun run test:api` 使用配置的 PostgreSQL，为每个用例创建随机 `auth_test_*` / `access_test_*` schema，单独执行迁移并清理。测试账号需 CREATE SCHEMA 权限。请使用专用测试数据库；不要给测试账户生产权限。`bun run test:server` 不需要数据库，覆盖健康、错误、代理地址和资源关闭。完整流程见 [工程验证](./engineering-verification.md)。

2026-10-05 模块实例与职责整理验收：lint、全工作区类型检查与构建通过；API 测试 33 项、架构测试 13 项通过。覆盖共享插件下并发身份隔离、运行中拒绝替换资源、非法来源、撤权、停用、密码重置、审计回滚与代理限流；新增过期会话被权限服务拒绝时仍转交 Cookie 清除响应头的回归用例。开发服务加载新代码后，浏览器原有登录仍可读取人员和审计列表。
