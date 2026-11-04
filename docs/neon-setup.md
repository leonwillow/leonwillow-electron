# Neon 测试环境

维护日期：2026-11-03；以下保留 2026-10-20 的 Neon 接入记录。

当前 PostgreSQL 已切换至 `100.100.1.3:5432/leonwillow`，目标库仅建立项目表结构并初始化管理员，没有复制 Neon 中的数据。实际连接与初始化记录见 [后端认证](./auth-backend.md)。Neon S3 原件存储继续沿用已有配置。下文中的数据库地址、原账号数量和迁入结果属于历史环境；再次执行 Neon 环境拉取会覆盖数据库变量，需保留当前 PostgreSQL 的 `DATABASE_URL` 与 `DATABASE_URL_UNPOOLED`。

当前应用继续使用 CSR Web、Bun/Elysia、Better Auth、Drizzle 和 `pg`。Neon 托管 PostgreSQL 与私有 S3 对象存储，不托管这份前端，也不替代现有 Neo4j 图数据库。

## 环境与命令

本次连接的测试项目为 `flat-haze-84210537`，组织为 `org-twilight-bar-17539649`，分支名为 `production`。已执行仓库现有的八份 Drizzle 迁移，并按最终确认的范围迁入本地账号、权限和文书数据。资金案件、银行流水及关联原件暂不迁入；Neo4j 不做迁移。Docker 只获准为这次导出临时启动，源数据和数据卷均保留。

Neon 控制台提供的英文提示是供编程助手执行的接入流程。CLI 全局安装曾遇到 `ECONNRESET`，后续通过 `npx neon@latest` 完成初始化、浏览器授权与部署。CLI 添加的 `@neon/config`、`@neon/env` 由 Bun 管理，只保留 `bun.lock`。

`neon.ts` 声明私有桶 `funds-originals`。项目关联记录保存在忽略的 `.neon`，密钥只写入忽略的环境文件。后续配置可执行：

```sh
npx neon@latest login
npx neon@latest deploy
npx neon@latest env pull --file apps/server/.env
bun run db:migrate
bun run dev
```

`deploy` 在根目录拉取 `.env.local`；服务端禁用了 Bun 隐式 dotenv 加载，因此须再显式拉取到 `apps/server/.env`。该命令保留文件内既有的认证与其他服务配置。数据库工具通过 Varlock 复用服务端环境，Web 不读取数据库或存储密钥。

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 带 `-pooler` 的应用连接，复用现有 `pg.Pool` |
| `DATABASE_URL_UNPOOLED` | 不带 `-pooler` 的迁移和集成测试连接，保留 `search_path` 隔离 |
| `AWS_ENDPOINT_URL_S3` | Neon 当前分支的 S3 端点；设置后优先于本地 RustFS |
| `AWS_REGION` | 与 Neon 端点匹配的签名区域 |
| `AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY` | 服务端 S3 凭据，不能放入 `VITE_*` |
| `RUSTFS_BUCKET` | 兼容原配置的桶名，默认 `funds-originals`，与 `neon.ts` 一致 |

本次数据库 URL 显式使用 `sslmode=verify-full` 保持证书校验；重新拉取时 CLI 可能恢复 `sslmode=require`，可在本地 URL 调整该参数。连接工厂开启可用的 SCRAM channel binding，建立连接限时 10 秒。迁移与测试优先用直连，不能把依赖会话级 `search_path` 的隔离测试改成池化连接。

S3 适配保留原来的案件路径、SHA-256 回读校验和私有下载权限，使用 AWS 标准字段和 path-style 寻址。配置了 Neon 端点却缺少其余凭据时启动即报错，不静默改用本机存储。未配置 Neon 端点时仍兼容原 RustFS。已有原件对象和数据库引用需要配套迁移，不能仅更改桶地址就认为旧文件已经搬迁。

## 账号与本地运行

当前 Neon 已保留原来的 2 个账号及密码哈希、身份和权限，直接使用原账号密码登录，无需重新初始化管理员。旧会话按原到期时间保留，不延长过期会话。Web 默认地址为 `http://localhost:3001`，API 为 `http://localhost:3000`。

仅在将来另建空库时，才需要在受控本地 zsh 终端用自己选择的密码显式初始化管理员：

```sh
read -rs 'ADMIN_INITIAL_PASSWORD?初始管理员密码：'
export ADMIN_INITIAL_PASSWORD
bun run auth:init
unset ADMIN_INITIAL_PASSWORD
```

该初始化命令的账号为 `admin`，已有完整管理员不会被覆盖；普通启动不创建账号。

不启动 Docker 也能测试登录、权限、文书、案件记录和原件上传下载。资金清洗后续图同步、资金图查询与完整资金集成用例仍需要可用的 `NEO4J_URI`、`NEO4J_USER`、`NEO4J_PASSWORD`；如要完全移除本机 Docker 依赖，需另行连接托管 Neo4j。

## 验证范围

执行 lint、类型检查、Bun 构建与 `npm run build`，并在 Neon 上运行真实密码、事务回滚和文书接口的隔离数据库用例。API 测试的默认等待上限及显式长用例均调整为 120 秒，容纳跨网络的迁移建表和业务事务；不改变断言或跳过失败。

完整 `test:api` 还包含 Neo4j 与文件存储的资金分析用例，未配置图数据库时不能据 PostgreSQL 和 S3 验证通过宣称全套测试通过。

2026-10-20 接入阶段验收（迁入旧数据前）：

| 检查 | 结果 |
| --- | --- |
| `npx neon@latest deploy` | 创建私有桶，显示 `Utilized services: Postgres, Object Storage`，拉取 7 个环境变量 |
| `bun run db:migrate` | `migrations applied successfully`，8 份迁移、19 张业务表 |
| `bun run lint` | 300 个文件通过，UI 规范检查通过 |
| `bun run check-types` | 10 个工作区任务通过，根类型检查通过，包含 `neon.ts` |
| `bun run build`、`npm run build` | 均显示 `6 successful, 6 total` |
| `bun run test:server` | 41 pass、0 fail |
| 真实管理员并发初始化与密码测试 | 1 pass、0 fail；其余认证用例未在此命令运行 |
| 审计失败回滚测试 | 1 pass、0 fail；账号、凭据与授权一起回滚 |
| 文书取号、修改与 Word 下载测试 | 1 pass、0 fail，15 个断言 |
| 运行中的生产构建与 Neon | 登录、会话、创建案件、上传、查询任务和原件下载均为 200；309 字节逐字节及 SHA-256 校验一致 |
| 权限与清理 | 匿名对象读取 403；退出后旧会话 401；临时账号、案件、任务、对象及中断测试的 schema 已清理 |

本机原始构建、类型检查、选定用例及端到端日志保留在 Git 忽略的 `tmp/neon-setup/`。数据库的 TLS 客户端确认 `encrypted=true`、`certificate authorized=true`。实际端到端输出包含：

```text
PostgreSQL: 19 application tables; 8 migrations
Object Storage E2E: 309 bytes uploaded/downloaded through app; SHA-256 MATCH
Anonymous object read: 403, private access enforced
Logged-out session: 401
NEON DATABASE + OBJECT STORAGE E2E PASS
```

遇到的问题：全局 CLI 安装出现 `ECONNRESET`，改用 `npx` 成功；迁移的交互标记阻止无 TUI 执行，修正后根命令成功；初轮测试的默认 hook 与文书显式 20 秒上限不足，调整为 120 秒后选定用例通过。期间数据库出现间歇性连接中断，额外的 `config plan` 也曾无法连接 Neon API；后续实际应用链路完整通过。本机 Neo4j 连通检查为 `ServiceUnavailable`，没有启动 Docker，因此完整资金分析与全量 API 套件未完成。

官方依据：[Neon PostgreSQL 驱动与连接](https://neon.com/docs/guides/node)、[连接池限制](https://neon.com/docs/connect/connection-pooling)、[S3 兼容范围](https://neon.com/docs/storage/s3-compatibility)。

## 旧数据迁移结果

2026-10-20 根据最终确认的范围，仅迁入认证、权限和文书的 12 张表：

| 内容 | 表与记录数 |
| --- | --- |
| 人员与密码凭据 | `user` 2、`account` 2 |
| 权限与审计 | `user_module_access` 3、`access_audit` 3 |
| 文书配置 | `document_type` 1、`document_template` 1、`document_sequence` 1 |
| 文书记录与修订 | `document_record` 0、`document_revision` 0；源库也是 0 |
| 会话、限流与验证 | `session` 5、`rate_limit` 1、`verification` 0 |

导入前备份本地源库与 Neon，核对当前 19 张表的字段类型、空值与默认值一致，再在单一事务内恢复选定数据。所有 12 张表的行数及完整行内容摘要都与源库相同，密码没有重置，原 ID 没有重新生成。Neon 保留仓库的 8 条迁移历史；源库额外的旧资金模块迁移不复制到这个范围。

此前整库导入在连接中断后回滚，没有提交银行流水。最终检查 `funds_case`、`funds_transaction`、`funds_source` 均为 0，5 张旧版 `fund_*` 表未创建。没有将旧资金数据或 16 个旧原件上传到 Neon。

原始完整数据库备份、16 个原件的本地备份、Neon 导入前备份以及核对报告保存在 Git 忽略且受限访问的 `tmp/neon-data-migration/`。这些文件包含业务数据或认证数据，不应提交到 Git。核心文件为 `source.dump`、`neon-before.dump`、`local-originals-backup/` 和 `verification.json`。Docker 在迁移核对后关闭，后续登录、权限与文书测试使用 Neon。
