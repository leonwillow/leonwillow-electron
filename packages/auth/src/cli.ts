/**
 * @file 认证 schema 生成工具的配置入口。
 * 创建时间：未记录（现有文件尚无 Git 创建记录）
 * 修改时间：2026-10-04
 * 版本作用：服务端认证基础层，随工作区维护。
 * 被调用：auth 的 schema:generate 命令。
 * 调用：better-auth、./config。
 * 功能：向官方 CLI 暴露与运行时相同的认证选项。
 * 预期结果：生成表定义无需启动应用或连接数据库。
 */
import { betterAuth } from "better-auth";
import { authOptions } from "./config";

export const auth = betterAuth({
	...authOptions,
	baseURL: "http://localhost:3000",
});
