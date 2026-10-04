/**
 * @file 数据库表与关系的公开出口。
 * 创建时间：2026-10-03（Git 首次收录）
 * 修改时间：2026-10-04
 * 版本作用：服务端数据基础层，随工作区维护。
 * 被调用：packages/auth/src/index.ts、packages/auth/src/bootstrap.ts、packages/db/src/index.ts、apps/server/test/auth.test.ts。
 * 调用：./auth。
 * 功能：集中导出认证 schema，保持包外导入路径稳定。
 * 预期结果：认证适配器和迁移工具读取相同表定义。
 */
export * from "./auth";
