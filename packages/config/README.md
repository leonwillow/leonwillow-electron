# 共享开发配置

包名：`@platform/config`。当前只提供 `@platform/config/typescript/base.json`。

基础配置统一严格类型检查、模块解析和无产物检查。各代码包自己选择运行环境的 `lib` 与 `types`，避免浏览器代码意外获得 Bun 或 Node 全局类型。

这个基础配置用于 server、desktop 与 access-contract。Web 使用 Nuxt 官方生成的 `.nuxt/tsconfig.*.json` 项目引用，需要补充的检查选项通过 `nuxt.config.ts` 配置。Electron 与 Bun 已分别接入各自的运行时类型。

后续实际选定 lint、格式化工具时再增加对应配置，不预先注册空任务。官方依据和当前限制见[框架约定](../../docs/framework-conventions.md)。
