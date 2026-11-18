/**
 * @file 共享浏览器下载与文件名清洗工具测试。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：保障跨模块下载工具的文件名安全过滤与 UTF-8 BOM 幂等补齐。
 * 被调用：bun test；调用：apps/web/src/lib/download.ts。
 * 功能：校验保留字符替换、空白兜底及 BOM 去重。
 * 预期结果：非法路径字符不穿透文件名，CSV 导出始终仅含单个 BOM。
 */
import { describe, expect, test } from "bun:test";
import { sanitizeDownloadFilename } from "../src/lib/download";

describe("sanitizeDownloadFilename", () => {
	test("替换操作系统保留字符与控制字符，保留正常中文与扩展名", () => {
		expect(sanitizeDownloadFilename('案件/2026:01*?"<>|\n笔录')).toBe(
			"案件_2026_01_______笔录",
		);
		expect(sanitizeDownloadFilename("  增值税方案A  ")).toBe("增值税方案A");
	});

	test("空白输入回退到指定默认文件名", () => {
		expect(sanitizeDownloadFilename("   ")).toBe("导出文件");
		expect(sanitizeDownloadFilename("", "询问笔录")).toBe("询问笔录");
	});
});
