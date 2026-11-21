/**
 * @file 本机平台的 Electron 应用打包入口。
 * 创建时间：2026-11-10；修改时间：2026-11-21。
 * 被调用：desktop package；调用：@electron/packager、@electron/fuses、Node fs。
 * 功能：只把已经构建的桌面入口、前端和公开配置装入应用，并对产物启用 Electron Fuses 加固。
 * 预期结果：产物位于 dist/release；禁用 RunAsNode 与调试检查参数，仅从 asar 加载应用，无后端代码与密钥。
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FuseV1Options, FuseVersion, flipFuses } from "@electron/fuses";
import { packager } from "@electron/packager";

const root = import.meta.dir;
const stage = join(root, "dist/package-stage");
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const platform = process.platform;
const arch = process.arch;
if (
	!["darwin", "win32", "linux"].includes(platform) ||
	!["x64", "arm64"].includes(arch)
)
	throw new Error("当前打包命令支持 macOS、Windows、Linux 的 x64/arm64 平台。");
await rm(stage, { recursive: true, force: true });
await mkdir(join(stage, "dist"), { recursive: true });
for (const file of ["main.cjs", "preload.cjs", "config.json", "renderer"])
	await cp(join(root, "dist", file), join(stage, "dist", file), {
		recursive: true,
	});
await writeFile(
	join(stage, "package.json"),
	JSON.stringify({
		name: "aidesk-desktop",
		productName: "AIDesk",
		version: manifest.version,
		main: "dist/main.cjs",
		description: manifest.description,
	}),
);
const outputs = await packager({
	dir: stage,
	out: join(root, "dist/release"),
	name: "AIDesk",
	appBundleId: "dev.leonwillow.aidesk",
	electronVersion: manifest.devDependencies.electron,
	platform: platform as "darwin" | "win32" | "linux",
	arch: arch as "x64" | "arm64",
	asar: true,
	overwrite: true,
	prune: false,
});
for (const outputDir of outputs) {
	const executablePath =
		platform === "darwin"
			? join(outputDir, "AIDesk.app")
			: platform === "win32"
				? join(outputDir, "AIDesk.exe")
				: join(outputDir, "AIDesk");
	await flipFuses(executablePath, {
		version: FuseVersion.V1,
		resetAdHocDarwinSignature: platform === "darwin",
		[FuseV1Options.RunAsNode]: false,
		[FuseV1Options.EnableCookieEncryption]: true,
		[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
		[FuseV1Options.EnableNodeCliInspectArguments]: false,
		[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: platform !== "linux",
		[FuseV1Options.OnlyLoadAppFromAsar]: true,
		[FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
	});
}
console.info(outputs.join("\n"));
