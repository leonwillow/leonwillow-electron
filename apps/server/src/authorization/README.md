# 平台授权

| 目录 | 职责 |
| --- | --- |
| `permissions/` | 解释角色授予的操作权限，集中处理超级管理员特例 |
| `data-scope/` | 按当前操作选择相关角色，将其范围合并为受限查询条件 |
| `snapshots/` | 从授权事实构造快照，管理版本和失效 |

这里实现本平台的授权规则，xlt-token 的 HTTP 适配位于 `../infrastructure/auth`，Elysia 声明式入口位于 `../plugins`。本轮只有目录，尚无任何放行或拒绝逻辑。
