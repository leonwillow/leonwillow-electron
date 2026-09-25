# 业务模块

`auth` 负责登录行为，`system` 下的用户、角色、资源和部门共同组成权限管理基础；`sessions`、`audit` 提供平台公共能力。

目前仅 `test` 模块可运行，其他业务目录占位。增加功能时采用 [Elysia 官方推荐的功能目录](https://elysiajs.com/essential/best-practice#folder-structure)，以用户模块为例：

```text
system/users/
├── index.ts          Elysia 路由实例，处理 HTTP、调用业务服务
├── service.ts        用户业务逻辑
├── model.ts          请求和响应的校验模型，类型由模型推导
└── repository.ts     按需增加：数据库查询、写入和数据范围约束
```

这是后续实现时的文件布局，当前没有生成这些空文件。前三种职责来自官方推荐；`repository.ts` 是本项目的数据访问约定，不要求每个模块凑齐四个文件。`model.ts` 表示接口模型，Drizzle 表结构仍归 `infrastructure/database/schema/`。

路由使用 Elysia 实例和链式调用；业务服务接收明确的参数，不接收整个 Elysia `Context`。服务可以使用函数或类，根据是否需要持有依赖选择。跨模块协作通过业务服务完成，避免调用对方的路由处理器。

模块在使用处显式 `.use(...)` 注册所需插件。认证主体通过请求级 `resolve` 或 macro 建立；不要将当前用户保存到共享的 `state` 或可变的 `decorate` 对象中。插件的 hook 有作用域，不能假设在应用入口注册后所有子模块都会自动获得相同的校验与类型。[上下文扩展](https://elysiajs.com/patterns/extends-context)、[插件作用域](https://elysiajs.com/essential/plugin#scope)

用户、角色、资源之间的关系和未决约束见根目录的领域词汇与设计基线，当前目录并未冻结数据库字段。
