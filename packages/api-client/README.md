# 公共请求客户端

包名：`@platform/api-client`。保存独立于 UI 框架的 Eden + Alova 请求代码，便于更换前端框架时复用。当前只提供 `test()`，不包含认证、业务缓存、路由或组件逻辑。

| 位置 | 职责 |
| --- | --- |
| `src/index.ts` | `createApi({ baseURL, statesHook })`，创建客户端并提供 test 请求工厂 |
| `src/adapters/eden.ts` | 将 Alova 请求执行委托给 Eden，处理响应、取消与超时 |
| `src/requests/` | 后续按业务模块组织请求工厂，目前占位 |
| `src/cache/` | 后续缓存身份、账号隔离与失效策略，目前占位 |
| `src/errors/` | 后续统一请求错误类型，目前占位 |

调用链：页面 → Alova Method → Eden 适配器 → Eden Treaty → Elysia。创建 Method 不立即请求；实际发送时才调用 Eden。适配器将 HTTP 失败转换为拒绝，并将取消与 10 秒超时传递给 `AbortSignal`。当前关闭响应缓存，保证每次点击测试按钮都会请求后端。

## 应用负责初始化

Nuxt SPA 在 `apps/web/app/plugins/api.client.ts` 读取运行配置并传入 Vue 状态适配器：

```ts
import { createApi } from '@platform/api-client';
import VueHook from 'alova/vue';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  return {
    provide: {
      api: createApi({
        baseURL: config.public.apiBaseUrl,
        statesHook: VueHook,
      }),
    },
  };
});
```

`statesHook` 保留泛型推导，页面的 `useRequest` 可以获得相应框架的状态类型与 Eden 推导的响应类型。将来使用 React 时，在 React 应用中传入 `alova/react` 的状态适配器；页面、路由和应用初始化仍由对应框架实现，不放进本包。[Alova 框架适配](https://alova.js.org/tutorial/getting-started/basic/combine-framework/)

本包不导入 `vue`、`nuxt`、`react` 或它们的状态适配器，不调用 `useNuxtApp()`、`useRuntimeConfig()`，也不读取应用环境变量。组件中的 `useRequest`、消息提示和路由跳转留在前端应用。

## 依赖与构建

- `@elysia/eden` 是请求包的运行依赖；`alova` 作为 peer dependency，由前端提供，开发时使用相同版本，避免客户端与页面使用不同的 Alova 实例管理机制。
- `@platform/server` 和与后端同版本的 `elysia` 是开发依赖；通过 `import type` 从 `@platform/server/types` 获取接口契约，浏览器不导入后端实现，不维护第二份手写 DTO。
- 这是仓库内使用的私有源码包，`exports` 直接导出 `src/index.ts`，由消费方的构建工具编译。没有单独的 build / dev 任务；运行 `bun run typecheck` 检查本包。[Turborepo 内部包](https://turborepo.dev/docs/core-concepts/internal-packages)
