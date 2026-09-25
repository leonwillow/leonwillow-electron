# 框架约定与目录审查

核对日期：2026-09-26。依据：本地 `nuxt`、`vue`、`nuxt-ui`、`elysiajs` skills，以及下文链接的官方文档。Skill 用于辅助检查；其中的偏好与示例不直接视为框架的强制要求。Nuxt 按 4.x 目录规范组织，运行依赖已在各应用与 `bun.lock` 中锁定。

当前已完成最小运行入口：Nuxt 测试页、Elysia `GET /test` 和 Electron 最小窗口。本文同时记录框架组织约定；除 test 外的业务目录仍占位。

## 审查结论

| 检查项 | 当前情况 | 处理 |
| --- | --- | --- |
| Nuxt 源码位置 | `apps/web/app/`，`public/` 位于 Web 根目录 | 符合 Nuxt 4 约定，保留 |
| 页面与组件 | `pages/`、`layouts/`、`components/` 等位置正确 | 页面继续按文件生成路由 |
| 前端请求代码 | `packages/api-client/` 提供框架无关的请求工厂 | 由 Nuxt 插件传入 API 地址与 `VueHook`，便于更换前端 |
| Web 类型检查 | Nuxt 生成的项目引用与 `nuxt typecheck` | 已替换临时配置并验证 |
| Vue 组件 | `app.vue` 与唯一测试页 | 使用 Nuxt UI、Composition API 与 TypeScript |
| Elysia 模块 | test 使用 `index.ts / model.ts` | 后续有业务逻辑时再增加 `service.ts` |
| 数据访问及授权目录 | `repository`、`authorization`、`infrastructure` 等 | 标为项目选择，不把它们说成官方强制分层 |
| Elysia 入口与 Eden 类型 | 工厂、监听入口和类型出口已接通 | 请求包通过 `import type` 消费 Eden 契约 |

`routes.ts / schemas.ts` 本身不是错误名称。改成 `index.ts / model.ts` 是为了让本项目与 Elysia 推荐示例一致。测试模块没有业务服务与数据访问，不生成空的 service / repository。

## Nuxt 4：使用约定的目录与生成配置

`apps/web` 是 Nuxt 根目录，默认源码位于 `app/`。特殊目录沿用原名，业务分类放在这些目录内部，例如 `pages/system/users/index.vue`。`app/types/` 是普通类型目录；不因为位于 `app/` 就获得自动导入或路由能力。公共请求包通过 workspace 名称显式导入，Nuxt 初始化位于 `app/plugins/api.client.ts`。没有用途时，不必把官方文档列出的可选目录全部创建出来。[目录结构](https://nuxt.com/docs/4.x/directory-structure)

页面由代码提供，后端资源树决定导航与准入。页面的权限元数据通过 `definePageMeta` 声明，路由检查放 `app/middleware/`；需要全局执行时用 `.global.ts`。中间件只改善客户端访问流程，接口仍由 Elysia 授权。[文件路由](https://nuxt.com/docs/4.x/directory-structure/app/pages)、[路由中间件](https://nuxt.com/docs/4.x/directory-structure/app/middleware)

`composables/` 默认扫描顶层。复杂功能可以有内部子目录，但通过顶层导出或显式导入访问；不为所有业务目录开启递归自动导入。依赖 Nuxt 上下文的调用在组件、插件或合适的 composable 调用链中执行。[composables](https://nuxt.com/docs/4.x/directory-structure/app/composables)、[自动导入](https://nuxt.com/docs/4.x/guide/concepts/auto-imports)

在 `apps/web/nuxt.config.ts` 设置 `ssr: false`。静态交付使用 `nuxt generate`，发布 `.output/public`，宿主处理 SPA 深链接回退。Web 与 Electron 使用同一份前端；Nuxt 构建工具链不承担独立 Elysia 后端的业务职责。[渲染与静态部署](https://nuxt.com/docs/4.x/guide/concepts/rendering)

### 类型配置

Web 的正式 `tsconfig.json` 采用官方 Nuxt 4 项目引用结构：

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

项目已采用此配置。由 `nuxt prepare` 生成被引用文件；通过 `nuxt.config.ts` 补充类型选项，不手动覆盖 Nuxt 管理的 `paths`、`include` 与自动导入。保留生成的 server 类型上下文不意味着需要创建业务 `server/` 目录。[官方 tsconfig](https://nuxt.com/docs/4.x/directory-structure/tsconfig)

已安装 TypeScript 6.0.3 与 vue-tsc 3.3.11，Web 使用 `nuxt typecheck`。Nuxt 默认的开发与构建命令不等于类型检查，通用 `tsc --noEmit` 无法代替这一步。TypeScript 7 在本轮出现 vue-tsc 入口兼容错误，因此未继续使用。[官方 TypeScript 指南](https://nuxt.com/docs/4.x/guide/concepts/typescript)

### Nuxt UI 与 Tailwind

采用官方 Nuxt 安装方式：安装 `@nuxt/ui` 与 `tailwindcss`，在 `nuxt.config.ts` 注册 `@nuxt/ui`，CSS 入口放 `app/assets/css/main.css`，引入 `tailwindcss` 和 `@nuxt/ui`。按当前这套集成方式，不额外叠加另一套 Tailwind Nuxt 模块或旧版配置。

根组件放 `app/app.vue`。目前唯一测试页使用 `<UApp>` → `<NuxtPage>`；需要实际公共布局时再加入 `<NuxtLayout>`。其中 `<UApp>` 为通知、Tooltip 和程序式弹层提供支持。[Nuxt UI 安装](https://ui.nuxt.com/docs/getting-started/installation/nuxt)、[Nuxt 根组件与布局](https://nuxt.com/docs/4.x/directory-structure/app/app)

## Vue：遵循组件约定，不再套一层应用目录

采用 Composition API，有脚本逻辑的 SFC 使用 `<script setup lang="ts">`。组件定义明确的 props 与 emits，公共状态与可复用逻辑提取为 composable；请求执行仍按已选定的 Alova → Eden 方案组织。Nuxt 已提供应用组织方式，不再追加另一套 Vue `src/`、`views/`、`router/` 骨架。[script setup](https://vuejs.org/api/sfc-script-setup.html)

Vue 3.5+ 官方支持响应式 props 解构，不能把 skill 的“避免解构”偏好写成框架禁令。`ref`、`reactive`、`shallowRef` 按状态需求选择；需要跟踪嵌套编辑的表单不能仅因为一条通用偏好就一律使用浅响应式。[响应式 props 解构](https://vuejs.org/api/sfc-script-setup.html#reactive-props-destructure)、[浅响应式](https://vuejs.org/api/reactivity-advanced.html#shallowref)

## Elysia：功能模块与完整类型推导

模块采用 `index.ts / service.ts / model.ts`；`model.ts` 定义接口运行时校验，并由它推导类型，不是数据库实体。需要数据访问时增加 `repository.ts`。这是按官方建议做出的项目约定；Elysia 本身不强制目录或服务类写法。[官方 Best Practice](https://elysiajs.com/essential/best-practice)

`app.ts` 组装模块并返回完整链式调用的结果，`index.ts` 负责装配和监听。`types.ts` 从应用工厂的 `ReturnType` 导出 `App`，前端只做 `import type`。不要使用宽泛的 `Elysia` 返回标注或普通数组循环注册来丢失具体路由推导。后端源码内部优先相对导入，避免与 Nuxt 的 `@` / `~` 别名冲突。[Eden 安装与类型要求](https://elysiajs.com/eden/installation)

Elysia 插件显式注册，认证相关 hook 明确作用域与顺序；当前主体通过请求级 `resolve` 或 macro 得到，普通业务服务只接收需要的参数。`state` 与初始化时的 `decorate` 对象不能作为可变的“当前用户”容器。[插件作用域](https://elysiajs.com/essential/plugin)、[上下文扩展](https://elysiajs.com/patterns/extends-context)

`authorization/` 存放平台权限规则，`infrastructure/` 连接 xlt-token、Drizzle、Redis，`plugins/` 负责 Elysia 接入。这是对本项目需求的划分；具体模块目录说明见 [server](../apps/server/README.md) 与 [modules](../apps/server/src/modules/README.md)。

## 当前验证范围

最小运行基础的检查包括：

1. Nuxt：`nuxt prepare`、`nuxt typecheck` 与静态构建通过，测试页面可发起请求并显示结果。
2. Elysia / Eden / Alova：真实 HTTP 响应、延迟发送、关闭缓存、HTTP 错误转换、请求取消与桌面来源 CORS 已检查。
3. Electron：开发模式与静态产物模式均可显示同一页面、调用独立后端；窗口关闭后不终止独立后端。

根 `bun run typecheck` 检查五个有源码的工作区；`bun run build` 生成三个应用的产物。请求包直接导出源码，由 Web 编译；状态适配器通过泛型传入，保留框架状态与响应推导。Turbo 显式声明 Web 构建环境与产物，桌面构建依赖 Web。当前只有 test 功能，未接入认证、数据库或角色授权。
