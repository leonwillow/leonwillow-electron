/**
 * @file 浏览器二进制与文本文件下载的共享适配工具。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：统一各业务模块的对象 URL 下载、文件名安全清洗与 UTF-8 BOM CSV 导出。
 * 被调用：lib/calculators、lib/documents、lib/funds、lib/inquiries。
 * 调用：浏览器 Blob / URL / DOM Anchor API。
 * 功能：触发浏览器本地保存并在延迟后回收临时 Object URL，不写入本地持久化存储。
 * 预期结果：消除跨模块重复下载样板，避免内存泄漏与非法系统文件名字符。
 */

/** 替换各操作系统文件名保留字符与控制字符，空文件名时使用指定兜底名。 */
export function sanitizeDownloadFilename(
	name: string,
	fallback = "导出文件",
): string {
	let cleaned = name;
	for (let i = 0; i < cleaned.length; i++) {
		if (cleaned.charCodeAt(i) < 32) {
			cleaned = Array.from(cleaned, (ch) =>
				ch.charCodeAt(0) < 32 ? "_" : ch,
			).join("");
			break;
		}
	}
	return cleaned.replace(/[\\/:*?"<>|]/g, "_").trim() || fallback;
}

/** 触发 Blob 浏览器下载并在触发后延迟释放临时 Object URL。 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 将纯文本按指定 MIME 类型打包为 Blob 并触发浏览器下载。 */
export function downloadTextFile(
	content: string,
	filename: string,
	type: string,
): void {
	downloadBlob(new Blob([content], { type }), filename);
}

/** 自动补齐唯一 UTF-8 BOM（兼容 Excel 直接打开中文）并下载 CSV 文件。 */
export function downloadUtf8Csv(content: string, filename: string): void {
	downloadTextFile(
		`\uFEFF${content.replace(/^\uFEFF/, "")}`,
		filename,
		"text/csv;charset=utf-8",
	);
}
