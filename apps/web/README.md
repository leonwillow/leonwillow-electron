# Web 前端

包名：`@platform/web`。采用 Nuxt 4 SPA，承载浏览器与 Electron 共用的界面。当前只有 `app/pages/index.vue` 测试页，通过 Alova → Eden 请求 `GET /test`；已接入 Nuxt UI 与 Tailwind CSS，业务页面仍占位。

| 目录 | 内容 | 依据 |
| --- | --- | --- |
| `app/pages/` | 文件路由，按 auth、workspace、system、monitor 组织 | Nuxt 约定 |
| `app/layouts/` | 登录及平台公共布局 | Nuxt 约定 |
| `app/components/` | 公共展示组件和各模块的局部组件 | Nuxt 约定 |
| `app/composables/` | 可复用的界面状态与操作逻辑 | Nuxt 约定 |
| `app/middleware/` | 登录状态与页面准入检查 | Nuxt 约定 |
| `app/plugins/` | 初始化请求客户端、注入桌面能力等 | Nuxt 约定 |
| `app/assets/css/` | Tailwind CSS 和 Nuxt UI 样式入口 | Nuxt 的 assets 约定，css 是项目分类 |
| `public/` | 不经构建处理的静态资源 | Nuxt 约定 |
| `app/types/` | 页面状态、组件属性等仅前端使用的类型 | 项目自定义，普通类型显式导入 |

`apps/web` 是 Nuxt 项目根目录，`nuxt.config.ts` 放在这里；`app/` 是默认源码目录，`~` / `@` 指向 `app/`，`~~` / `@@` 指向 `apps/web/`。[官方目录约定](https://nuxt.com/docs/4.x/directory-structure)

已设置 `ssr: false`，接入 `@nuxt/ui`、`app/assets/css/main.css` 和 `<UApp>`。当前没有布局需求，`app.vue` 直接使用 `<NuxtPage>`。类型配置采用 Nuxt 4 生成的项目引用，使用 `nuxt prepare` 和 `nuxt typecheck`。[框架约定](../../docs/framework-conventions.md)

在本应用目录执行 `bun run dev` 启动开发服务，`bun run typecheck` 检查 Vue / TypeScript，`bun run build` 生成 `.output/public`。安装依赖后，仓库根 `postinstall` 会执行本应用的 `prepare` 任务。

页面使用文件路由，后端菜单引用既有页面。普通组件放 `components/`，不放入 `pages/` 使其成为路由。Vue 组件有脚本逻辑时使用 `<script setup lang="ts">`；可复用的有状态逻辑放 `composables/`。该目录默认只扫描顶层文件，嵌套逻辑要显式导入或从顶层导出。[Nuxt composables](https://nuxt.com/docs/4.x/directory-structure/app/composables)、[Vue script setup](https://vuejs.org/api/sfc-script-setup.html)

这里不创建 `server/`、服务端 API handler 或数据库访问代码。Nuxt 生成工具类型上下文不等于启用 Nuxt 业务后端。

业务请求通过 `@platform/api-client`；授权公共常量来自 `@platform/access-contract`。`app/plugins/api.client.ts` 导入请求包，传入 `alova/vue` 的 `VueHook` 与 API 地址，并注入 `$api`。页面继续通过 `useNuxtApp().$api` 和 `alova/client` 的 `useRequest` 调用接口。Eden 推导的 API 类型不在 `app/types/` 另抄一套。请求模块的细分职责见 [api-client/README.md](../../packages/api-client/README.md)。

页面中间件与按钮显隐服务于交互体验，最终授权由独立后端执行。桌面专有操作经受控桥接调用；页面不直接导入 Electron 或 Node.js API。

API 地址来自 `runtimeConfig.public.apiBaseUrl`，由 `app/plugins/api.client.ts` 传入客户端；默认 `http://127.0.0.1:3001`。可通过 `.env` 中的 `NUXT_PUBLIC_API_BASE_URL` 覆盖。静态部署与 Electron 的地址在构建时写入，需要改地址时重新构建。
