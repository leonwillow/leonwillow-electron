# 跨应用验证

`e2e/` 预留给浏览器和桌面连接独立后端的端到端用例，例如登录、权限变化和账号切换。

模块级测试放在所属应用或包；后端单元和集成测试分别位于 `apps/server/tests/unit/`、`apps/server/tests/integration/`。

当前前端授权规则测试位于 `apps/web/tests/`，从仓库根执行 `bun test apps/web/tests`。跨应用端到端套件仍未实现，未注册会空跑的全局测试命令。
