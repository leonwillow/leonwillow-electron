/**
 * @file Word 模板字段、原格式填充和无效内容的单元测试。
 * 创建时间：2026-10-10；修改时间：2026-11-21。
 * 版本作用：验证 DOCX 跨 run 字段、原件结构与 ZIP 炸弹/XML 变体防护，不依赖数据库。
 * 被调用：test:server / test:api；调用：真实示例 DOCX、模板编解码、PizZip。
 * 预期结果：无效模板、ZIP 炸弹与命名空间绕过不能进入取号事务，填入内容被 XML 转义且原排版保留。
 */
import { expect, test } from "bun:test";
import PizZip from "pizzip";
import example from "../src/modules/documents/assets/inquiry-notice.json";
import {
	inspectTemplate,
	renderDocument,
	validateValues,
} from "../src/modules/documents/template";

const bytes = Buffer.from(example.bytesBase64, "base64");
const alter = (replace: (xml: string) => string) => {
	const zip = new PizZip(bytes);
	zip.file(
		"word/document.xml",
		replace(zip.file("word/document.xml")?.asText() ?? ""),
	);
	return zip.generate({ type: "uint8array" });
};
test("询问通知书动态字段、跨 run 文号和 XML 转义保留原排版", () => {
	const fields = inspectTemplate(bytes, "询问通知书.docx");
	expect(fields).toHaveLength(10);
	expect(fields.find((field) => field.key === "询问日期")?.kind).toBe("date");
	const split = alter((xml) =>
		xml.replace("{文书号}", "{文书</w:t></w:r><w:r><w:t>号}"),
	);
	expect(inspectTemplate(split, "split.docx")).toHaveLength(10);
	const values = Object.fromEntries(
		fields.map((field) => [
			field.key,
			field.kind === "date"
				? "2026-10-10"
				: field.kind === "time"
					? "09:30"
					: "测试<&>内容",
		]),
	);
	const result = new PizZip(
		renderDocument(
			example.bytesBase64,
			fields,
			values,
			"滇税三稽查〔2025〕43号",
			2025,
			43,
			"询问通知书",
		),
	);
	const xml = result.file("word/document.xml")?.asText() ?? "";
	expect(xml).toContain("滇税三稽查〔2025〕43号");
	expect(xml).toContain("2026年10月10日9时30分");
	expect(xml).toContain("测试&lt;&amp;&gt;内容");
	expect(xml).not.toContain("{文书号}");
	const source = new PizZip(bytes);
	for (const part of [
		"word/styles.xml",
		"word/fontTable.xml",
		"word/theme/theme1.xml",
	])
		expect(result.file(part)?.asText()).toBe(source.file(part)?.asText());
	expect(xml.match(/<w:sectPr>[\s\S]*?<\/w:sectPr>/)?.[0]).toBe(
		source
			.file("word/document.xml")
			?.asText()
			.match(/<w:sectPr>[\s\S]*?<\/w:sectPr>/)?.[0],
	);
});
test("不完整草稿可预览，正式生成拒绝缺项、伪造字段与错误日期", () => {
	const fields = inspectTemplate(bytes, "a.docx");
	expect(() => validateValues(fields, {})).toThrow("请填写");
	expect(() => validateValues(fields, { 文书号: "私自取号" }, true)).toThrow(
		"未定义",
	);
	expect(() =>
		validateValues(fields, { 询问日期: "2026-02-30" }, true),
	).toThrow("有效日期");
	expect(() => validateValues(fields, { 询问时间: "24:00" }, true)).toThrow(
		"有效时间",
	);
	expect(validateValues(fields, {}, true)).toHaveProperty("机关名称", "");
});
test("错误文件、缺少文号、表达式、循环、外链及宏均拒绝", () => {
	expect(() => inspectTemplate(bytes, "template.doc")).toThrow(".docx");
	expect(() => inspectTemplate(new Uint8Array([1, 2, 3]), "a.docx")).toThrow(
		"压缩包",
	);
	expect(() =>
		inspectTemplate(
			alter((xml) => xml.replace("{文书号}", "号码")),
			"a.docx",
		),
	).toThrow("文书号");
	expect(() =>
		inspectTemplate(
			alter((xml) => xml.replace("{受询问人}", "{name.value}")),
			"a.docx",
		),
	).toThrow("字段");
	expect(() =>
		inspectTemplate(
			alter((xml) => xml.replace("{受询问人}", "{#人员}{姓名}{/人员}")),
			"a.docx",
		),
	).toThrow("普通文本");
	const zip = new PizZip(bytes);
	zip.file(
		"word/_rels/document.xml.rels",
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId88" Type="hyperlink" Target="https://example.com" TargetMode="External"/></Relationships>',
	);
	expect(() =>
		inspectTemplate(zip.generate({ type: "uint8array" }), "a.docx"),
	).toThrow("外部");
	zip.file("word/vbaProject.bin", "macro");
	expect(() =>
		inspectTemplate(zip.generate({ type: "uint8array" }), "a.docx"),
	).toThrow();
});

test("拒绝伪造 Central Directory 尺寸的 ZIP 炸弹、大写扩展名与自定义命名空间前缀绕过", () => {
	const bombZip = new PizZip(bytes);
	bombZip.file("word/padding.txt", "A".repeat(11 * 1024 * 1024));
	const bombBytes = bombZip.generate({
		type: "uint8array",
		compression: "DEFLATE",
	});
	// 篡改 Central Directory 中所有条目的声明未压缩大小为 16 字节，模拟伪造头部的 ZIP 炸弹
	const forged = new Uint8Array(bombBytes);
	const view = new DataView(forged.buffer);
	let end = forged.length - 22;
	while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
	const count = view.getUint16(end + 10, true);
	let pos = view.getUint32(end + 16, true);
	for (let i = 0; i < count; i++) {
		const nameLength = view.getUint16(pos + 28, true);
		const extraLength = view.getUint16(pos + 30, true);
		const commentLength = view.getUint16(pos + 32, true);
		if (view.getUint32(pos + 24, true) > 10 * 1024 * 1024) {
			view.setUint32(pos + 24, 16, true);
		}
		pos += 46 + nameLength + extraLength + commentLength;
	}
	expect(() => inspectTemplate(forged, "bomb.docx")).toThrow("过大");

	const upperExtZip = new PizZip(bytes);
	upperExtZip.file(
		"word/_rels/CUSTOM.RELS",
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId99" Type="hyperlink" Target="https://evil.example" TargetMode="External"/></Relationships>',
	);
	expect(() =>
		inspectTemplate(upperExtZip.generate({ type: "uint8array" }), "upper.docx"),
	).toThrow("外部");

	const prefixedRelZip = new PizZip(bytes);
	prefixedRelZip.file(
		"word/_rels/prefixed.rels",
		'<r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships"><r:Relationship Id="rId99" Type="hyperlink" Target="https://evil.example" TargetMode="external"/></r:Relationships>',
	);
	expect(() =>
		inspectTemplate(
			prefixedRelZip.generate({ type: "uint8array" }),
			"prefixed-rel.docx",
		),
	).toThrow("外部");

	const prefixedAltChunk = alter((xml) =>
		xml.replace(
			"<w:body>",
			'<w:body xmlns:w1="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w1:altChunk/>',
		),
	);
	expect(() => inspectTemplate(prefixedAltChunk, "altchunk.docx")).toThrow(
		"HTML",
	);

	const prefixedFldSimple = alter((xml) =>
		xml.replace(
			"<w:body>",
			'<w:body xmlns:w1="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w1:fldSimple w1:instr="HYPERLINK"/>',
		),
	);
	expect(() => inspectTemplate(prefixedFldSimple, "fld.docx")).toThrow(
		"自动域",
	);

	const upperXmlZip = new PizZip(bytes);
	upperXmlZip.file(
		"word/EXTRA.XML",
		'<w1:root xmlns:w1="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w1:instrText>EQ</w1:instrText></w1:root>',
	);
	expect(() =>
		inspectTemplate(
			upperXmlZip.generate({ type: "uint8array" }),
			"upper-xml.docx",
		),
	).toThrow("自动域");
});
