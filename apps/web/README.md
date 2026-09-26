# Web 前端

包名：`@platform/web`。采用 Nuxt 4 SPA，承载浏览器与 Electron 共用的界面。首页进入 `app/pages/auth/login.vue` 登录页，提供用户名和密码登录；已接入 Nuxt UI、Tailwind CSS 和前端权限显隐能力。当前登录使用本地模拟实现，真实认证接口尚未接入。

## 自动导入与显式导入

本节适用于本应用中由 Nuxt 编译处理的代码。当前 `nuxt.config.ts` 注册了 `@nuxt/ui`，保留 Nuxt 默认自动导入与组件扫描。优先直接使用已注册的能力，让文件顶部只保留必要的显式依赖；采用通用 Vue / Nuxt UI 文档或 skill 示例时，也按本节调整导入语句。

### 默认直接使用

| 场景 | 本项目写法 |
| --- | --- |
| 常用 Vue API | `ref`、`computed`、`watch`、`onMounted` 等直接使用，无需从 `vue` 或 `#imports` 重复导入 |
| Nuxt API | `useNuxtApp`、`useRuntimeConfig`、`useRoute`、`defineNuxtPlugin` 等直接使用 |
| Vue 编译宏 | `<script setup>` 中的 `defineProps`、`defineEmits`、`defineModel`、`defineExpose` 等直接使用；这是编译器能力，无需导入 |
| 模板组件 | `NuxtPage`、`NuxtLink`、`UApp`、`UButton` 等，以及 `app/components/` 中扫描到的组件，直接在模板中使用 |
| Nuxt UI 公共 composables | `useToast`、`useOverlay`、`defineShortcuts` 等由模块注册，直接使用 |
| 自定义 composables | `app/composables/` 顶层文件的导出自动导入；嵌套文件需要显式导入或从顶层导出 |

嵌套组件的名称包含目录前缀，例如 `app/components/system/UserCard.vue` 对应 `<SystemUserCard />`。局部辅助逻辑保持局部导入，仅将需要自动导入的公共能力从顶层导出；不为减少 import 扩大整个业务目录的扫描范围。

### 保留显式导入的情况

- **类型**：使用 `import type` 引用未自动提供的类型，例如 `import type { FormSubmitEvent } from '@nuxt/ui'`、`app/types/` 中的类型。组件自动注册不代表该库的所有类型也自动可用。
- **第三方依赖与共享包**：`alova/client` 的 `useRequest`、`alova/vue` 的 `VueHook`、`@platform/api-client`、`@platform/access-contract` 等按需显式导入。Nuxt UI 的 locale、未注册的工具函数也按其公开出口导入。
- **脚本中的组件引用**：`h()`、`overlay.create()`、动态组件映射等需要组件对象时，可从 `#components` 显式导入，或在适用场景使用 `resolveComponent('组件名')`。模板中的自动导入不等于脚本里存在同名变量；仅用于模板的组件省略 import。
- **自动导入范围以外或名称冲突**：未扫描的局部文件、需要别名区分的同名导出、脱离 Nuxt 编译运行的测试或脚本，按实际环境显式导入。`packages/*`、Elysia 后端和 Electron 主进程不沿用本应用的自动导入假设。

现有 [登录页面](app/pages/auth/login.vue) 和 [API 插件](app/plugins/api.client.ts) 可作为参考：Nuxt API 与模板组件直接使用，Nuxt UI 类型、Alova 和共享请求包保持显式导入。

### 核实与收尾

只有名称不确定、编辑器未识别或模块配置变更时，才检查自动导入声明。从仓库根执行 `bun run --cwd apps/web prepare`，核对 `.nuxt/imports.d.ts`、`.nuxt/types/imports.d.ts` 和 `.nuxt/components.d.ts`；这些文件由 Nuxt 生成，不手动维护。优先恢复生成类型，再判断是否确实需要显式导入。

完成前检查本次新增或修改的 import，移除自动导入范围内且没有上述用途的重复导入，保留必要的类型、第三方依赖和组件对象引用。涉及代码或配置修改时运行 `bun run --cwd apps/web typecheck`；类型检查验证名称与类型是否可用，冗余 import 仍需在改动检查中识别。

依据：[Nuxt 自动导入](https://nuxt.com/docs/4.x/guide/concepts/auto-imports)、[Nuxt 组件与动态组件](https://nuxt.com/docs/4.x/directory-structure/app/components)、[Nuxt UI 的 Nuxt 集成](https://ui.nuxt.com/docs/getting-started/installation/nuxt)。

## 目录与应用边界

| 目录 | 内容 | 依据 |
| --- | --- | --- |
| `app/pages/` | 文件路由，按 auth、workspace、system、monitor 组织 | Nuxt 约定 |
| `app/layouts/` | 登录及平台公共布局 | Nuxt 约定 |
| `app/components/` | 公共展示组件和各模块的局部组件 | Nuxt 约定 |
| `app/composables/` | 可复用的界面状态与操作逻辑 | Nuxt 约定 |
| `app/directives/` | 元素级角色与权限显隐，由插件注册 | 项目自定义 |
| `app/middleware/` | 登录状态与页面准入检查 | Nuxt 约定 |
| `app/plugins/` | 初始化请求客户端、注入桌面能力等 | Nuxt 约定 |
| `app/assets/css/` | Tailwind CSS 和 Nuxt UI 样式入口 | Nuxt 的 assets 约定，css 是项目分类 |
| `public/` | 不经构建处理的静态资源 | Nuxt 约定 |
| `app/types/` | 页面状态、组件属性等仅前端使用的类型 | 项目自定义，普通类型显式导入 |

[框架约定](../../docs/framework-conventions.md)

可复用的有状态逻辑放 `composables/`。[Nuxt composables](https://nuxt.com/docs/4.x/directory-structure/app/composables)、[Vue script setup](https://vuejs.org/api/sfc-script-setup.html)

这里不创建 `server/`、服务端 API handler 或数据库访问代码。Nuxt 生成工具类型上下文不等于启用 Nuxt 业务后端。

业务请求通过 `@platform/api-client`；授权公共常量来自 `@platform/access-contract`。`app/plugins/api.client.ts` 导入请求包，传入 `alova/vue` 的 `VueHook` 与 API 地址，并注入 `$api`。页面继续通过 `useNuxtApp().$api` 和 `alova/client` 的 `useRequest` 调用接口。Eden 推导的 API 类型不在 `app/types/` 另抄一套。请求模块的细分职责见 [api-client/README.md](../../packages/api-client/README.md)。

页面中间件与按钮显隐服务于交互体验，最终授权由独立后端执行。桌面专有操作经受控桥接调用；页面不直接导入 Electron 或 Node.js API。

API 地址来自 `runtimeConfig.public.apiBaseUrl`，由 `app/plugins/api.client.ts` 传入客户端；默认 `http://127.0.0.1:3001`。可通过 `.env` 中的 `NUXT_PUBLIC_API_BASE_URL` 覆盖。静态部署与 Electron 的地址在构建时写入，需要改地址时重新构建。

## 前端资源与按钮显隐

`useAccess()` 维护内存中的角色、权限快照。调用链为：登录/授权刷新 → `setAccess()` → 统一判断函数 → 指令、`v-if` 或资源入口过滤。`access.client.ts` 在界面挂载前全局注册指令，无需在各页面重复导入。

参考 [RuoYi Vue Plus 配套前端的权限指令](https://github.com/CrazyLionCat/plus-ui/blob/6.X-Vue/src/directive/permission/index.ts)及其[函数式判断](https://github.com/CrazyLionCat/plus-ui/blob/6.X-Vue/src/utils/permission.ts)：权限和角色来自当前用户，多个值默认表示“任一命中”。本项目增加 `.all`，并在授权刷新、撤权及绑定值变化时重新判断，使用可恢复的隐藏方式。

```vue
<template>
  <UButton v-has-permi="['system:user:add']">新增用户</UButton>
  <UButton v-has-permi="['system:user:add', 'system:user:edit']">维护用户</UButton>
  <UButton v-has-roles="['editor', 'reviewer']">角色专属操作</UButton>
  <UButton v-has-permi.all="['system:user:query', 'system:user:export']">查询并导出</UButton>
</template>
```

同一元素同时使用两种指令时，两者都通过才显示；`.all` 只影响所属指令。它们与 `v-show`、原有布局样式共同生效，权限重新获得后不会覆盖组件自身的隐藏状态。

需要在脚本中判断权限时，再从 `useAccess()` 取得 `hasPermission()` / `hasRole()`：例如在 `computed` 中过滤菜单、标签页和下拉菜单的 `items`。

### 接入授权状态

后续登录模块在取得当前用户的权威授权信息后调用以下入口；`roles`、`permissions` 应直接映射后端响应，不从菜单可见性推导，也不由页面自行授予。

## 登录页预览

访问 `/` 会替换跳转至 `/auth/login`。页面使用 `UAuthForm`，仅提供用户名和密码，均至少 5 位；用户名去除首尾空格后校验，密码保留原始输入。支持密码显隐、回车提交、提交中禁用和错误提示。

`app/utils/auth/mockLogin.ts` 模拟 450 毫秒延迟，仅接受 `admin / admin`。登录成功后在当前页面显示反馈，不创建真实会话、不写入权限状态，也不跳转工作台；后续接入公共请求客户端时替换此模拟函数。
