# 生成与工程验证

维护日期：2026-10-05。`verify` 不自动修复手写源码；生成文件、构建缓存、临时预览属于允许的检查产物。`verify:all` 额外使用隔离数据库 schema。

## 入口与责任

| 内容 | 命令/输入 | 输出与前置 | 缓存责任 |
| --- | --- | --- | --- |
| 环境类型 | `bun run env:generate`；各 `.env.schema` 及导入 | 各 `src/env.ts`；无需数据库 | Turbo `env:generate` 显式恢复输出，类型检查/构建依赖它 |
| 路由树 | `bun run routes:generate`；Web routes、锁定 CLI/插件 | `apps/web/src/routeTree.gen.ts` | Turbo `routes:generate` 显式恢复输出，Web 类型检查/构建依赖它；开发时继续由 Vite 插件维护 |
| 认证表 | `bun run auth:schema`；认证配置、锁定 auth CLI、生成适配脚本 | `packages/db/src/schema/auth.ts`；手写关系独立 | 显式执行，不缓存、不迁移 DB；提交前检查差异 |
| DB 迁移 | `bun run db:generate` 后人工审查 | migrations SQL/快照 | 不自动执行；上线独立调用 db:migrate |
| 手工 TS/TSX | `bun run check-types` | 工作区源码/测试/工具；根工程仅 scripts，UI 测试独立配置 | 生成前置先完成，再恢复检查缓存；根工具 tsc 每次执行 |

生成文件不手改。`bun install` 的 postinstall 执行环境与路由生成；即使跳过 postinstall，根类型检查/构建的任务链也补齐必要生成物。Web CLI 与 Vite 插件当前共用 router-generator 1.167.40；升级时一起核对锁定的生成器版本。

```sh
bun run lint
bun run check-types
bun run build
bun run test:ui
bun run test:architecture
bun run test:server
bun run test:deploy
bun run test:api
```

`bun run verify` 顺序执行无需数据库的完整门禁；`bun run verify:all` 再执行 API 集成测试。`check` 是 verify 的兼容入口，`fix` 才执行 Biome 自动修复。GitHub Actions 使用 Bun 1.3.14、锁文件安装和专用 PostgreSQL 18，并验证 schema 再生成不产生差异；本地修改尚未推送时不能视为远程 CI 已通过。

## 发布与复现

默认 Web 使用 `/`。`test:deploy` 临时启动 Vite preview，直接请求登录、设置、知识库深层地址，再逐项请求入口引用的 JS/CSS，要求正确状态与 MIME，完成后关闭自己的进程。

子路径验证使用独立产物目录：

```sh
bun run --cwd apps/web build --base=/desk/ --outDir /tmp/leonwillow-web-subpath
bun scripts/check-web-deployment.ts /desk/ /tmp/leonwillow-web-subpath
```

Vite base 控制资源，Router basepath 使用同一 BASE_URL。实际托管须正确处理 SPA fallback；浏览器验收需覆盖登录/注册互链、直接进入深层页面、刷新与认证跳转。Cookie、HTTPS、真实代理和 Electron 不由静态 smoke check 证明。

冷启动验证应在独立源码副本/检出中执行 `bun install --frozen-lockfile`、`bun run check-types`，不复制 `.env`、生成物或 node_modules。另在该副本移除四个可重新生成文件后再次执行类型检查，确认命中 Turbo 缓存仍恢复 env.ts 和 routeTree.gen.ts。不要为验收破坏正在开发的工作目录。

schema 连续生成两次，文件哈希必须一致；再运行认证测试，且不改写历史迁移。API 测试可用 `bun run --cwd apps/server test --test-name-pattern '会话'` 或 `'限流'` 独立筛选。

畸形 JSON 复现（服务运行时）：

```sh
curl -i http://localhost:3000/api/auth/login -H 'Origin: http://localhost:3001' -H 'Content-Type: application/json' --data '{'
```

预期 400、`code=INVALID_JSON`，响应包含 X-Request-ID。

## 本次结果

2026-10-04 本地验收完成：

| 检查 | 结果 |
| --- | --- |
| `bun run verify:all` | 通过；包含 lint、类型检查、前后端构建、UI 27 项、架构 13 项、服务端 21 项测试，以及根路径生产 smoke check |
| 独立源码副本 | 没有复制 .env、node_modules 或生成物；锁文件安装及类型检查通过 |
| 缓存恢复 | 在副本删除三个 env.ts 和路由树后，9 个任务全部命中缓存，四个生成文件均恢复；根工具类型检查也通过 |
| schema 再生成 | 连续运行产生相同字节；手写关系保留，历史 SQL/快照未修改 |
| 测试筛选 | 会话、退出和限流用例独立筛选通过；受信代理后的两个客户端具有独立的真实数据库限流计数 |
| `/desk/` 生产 smoke check | 登录、设置与知识库深层入口的 JS/CSS 状态和 MIME 正确 |
| 浏览器 | 子路径登录/注册互链、键盘 Enter 导航和刷新通过；使用独立测试 schema 的真实认证服务时，直接进入 `/desk/settings/general` 会跳转到 `/desk/login`。后端不可用时正确显示会话错误入口，前往登录链接保留前缀 |
| 文档与工作区 | 本地文档链接检查无断链，git diff --check 通过；临时预览、浏览器 API 和其测试 schema 已清理 |

远程 GitHub Actions 尚未运行；没有验证正式部署的 HTTPS/代理拓扑、跨站 Cookie 或 Electron 打包。主题编辑会话提取与工具环境解耦保留为后续按需工作。基线检查结果保留在 [评审记录](./project-structure-review.md)。
