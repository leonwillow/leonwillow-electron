/**
 * @file Electron 主进程网络栈的无页面集成验证。
 * 创建时间：2026-11-10；修改时间：2026-11-10。
 * 被调用：verify-network.ts；调用：真实 sessionRequest、临时 Node HTTP 服务。
 * 功能：验证 Cookie 跨进程持久化、端口会话隔离、退出删除及流中止。
 * 预期结果：不创建窗口、不控制 UI、不连接真实用户或业务数据。
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createServer, type RequestListener } from "node:http";
import { join } from "node:path";
import { app, protocol, session } from "electron";
import { networkPartition } from "../src/request-policy";
import { sessionRequest } from "../src/session-request";

protocol.registerSchemesAsPrivileged([
	{
		scheme: "aidesk",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true,
		},
	},
]);
const directory = process.argv[2];
const phase = process.argv[3];
if (!directory || !["save", "restore"].includes(phase ?? ""))
	throw new Error("测试参数缺失。");
app.setPath("userData", directory);
void app
	.whenReady()
	.then(async () => {
		const stateFile = join(directory, "test-state.json");
		const port: number =
			phase === "restore"
				? JSON.parse(await readFile(stateFile, "utf8")).port
				: 0;
		const respond: RequestListener = (request, response) => {
			response.setHeader("access-control-allow-origin", "aidesk://app");
			response.setHeader("access-control-allow-credentials", "true");
			if (request.url === "/login")
				response.setHeader(
					"set-cookie",
					"test-session=one; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600",
				);
			if (request.url === "/logout")
				response.setHeader(
					"set-cookie",
					"test-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
				);
			if (request.url === "/redirect") {
				response.writeHead(302, { location: "/login" });
				response.end();
				return;
			}
			if (request.url === "/stream") {
				response.writeHead(200, {
					"content-type": "application/octet-stream",
					"x-content-type-options": "nosniff",
				});
				response.write(Buffer.from([0, 255]));
				return;
			}
			response.setHeader("content-type", "application/json");
			response.end(
				JSON.stringify({
					cookie: request.headers.cookie ?? null,
					origin: request.headers.origin ?? null,
					method: request.method,
				}),
			);
		};
		const server = createServer(respond);
		const other = createServer(respond);
		await Promise.all([
			new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve)),
			new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve)),
		]);
		const address = server.address();
		const otherAddress = other.address();
		assert(
			address &&
				typeof address === "object" &&
				otherAddress &&
				typeof otherAddress === "object",
		);
		const url = `http://127.0.0.1:${address.port}`;
		const otherUrl = `http://127.0.0.1:${otherAddress.port}`;
		const one = session.fromPartition(networkPartition(url));
		const two = session.fromPartition(networkPartition(otherUrl));
		const options = {
			credentials: "include" as const,
			headers: { origin: "aidesk://app" },
			redirect: "error" as const,
		};
		try {
			if (phase === "save") {
				const response = await sessionRequest(one, `${url}/login`, {
					...options,
					method: "POST",
					body: "test",
				});
				assert(response.ok);
				assert.equal((await response.json()).method, "POST");
			}
			const body = await (
				await sessionRequest(one, `${url}/session`, options)
			).json();
			assert.equal(body.cookie, "test-session=one");
			assert.equal(body.origin, "aidesk://app");
			assert.equal(
				(
					await (
						await sessionRequest(two, `${otherUrl}/session`, options)
					).json()
				).cookie,
				null,
			);
			await assert.rejects(sessionRequest(one, `${url}/redirect`, options));
			const abort = new AbortController();
			const stream = await sessionRequest(one, `${url}/stream`, {
				...options,
				signal: abort.signal,
			});
			const reader = stream.body?.getReader();
			assert(reader);
			assert.deepEqual((await reader.read()).value, new Uint8Array([0, 255]));
			const pending = reader.read();
			abort.abort();
			await assert.rejects(pending);
			if (phase === "restore") {
				await (
					await sessionRequest(one, `${url}/logout`, {
						...options,
						method: "POST",
					})
				).arrayBuffer();
				assert.equal(
					(await (await sessionRequest(one, `${url}/session`, options)).json())
						.cookie,
					null,
				);
			}
			await one.cookies.flushStore();
			await writeFile(stateFile, JSON.stringify({ port: address.port }));
			console.info(
				phase === "save"
					? "Electron网络验证：登录 Cookie、来源头、端口隔离、二进制流中止和重定向拒绝通过。"
					: "Electron网络验证：重启会话恢复和退出删除 Cookie 通过。",
			);
		} catch (error) {
			console.error(
				error instanceof Error ? error.message : "Electron网络验证失败",
			);
			process.exitCode = 1;
		} finally {
			server.closeAllConnections();
			other.closeAllConnections();
			server.close();
			other.close();
			app.exit(Number(process.exitCode ?? 0));
		}
	})
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "测试初始化失败");
		app.exit(1);
	});
