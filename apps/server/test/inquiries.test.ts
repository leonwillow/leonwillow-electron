/**
 * @file 笔录完成规则、Word 文本转义和完整导出的领域测试。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：验证输入边界和可编辑输出，无数据库或认证依赖。
 * 被调用：Bun test；调用：笔录校验、导出器、XML 解析器。
 * 预期结果：草稿可渐进保存，错误完成请求被拒绝，长问答不在导出中截断。
 */
import { expect, test } from "bun:test";
import { DOMParser } from "@xmldom/xmldom";
import PizZip from "pizzip";
import {
	createInquiryDocx,
	inquiryFileName,
} from "../src/modules/inquiries/docx-export";
import { validateInquiry } from "../src/modules/inquiries/validation";
import { inquiryFixture } from "./inquiry-fixture";

test("草稿允许留空，完成要求完整信息、两名询问人和唯一记录人", () => {
	const draft = inquiryFixture();
	draft.content.subjectName = "";
	expect(() => validateInquiry(draft)).not.toThrow();
	draft.status = "final";
	expect(() => validateInquiry(draft)).toThrow("被询问人姓名");
	draft.content.subjectName = "测试";
	expect(() => validateInquiry(draft)).not.toThrow();
	draft.content.inquirers = draft.content.inquirers.slice(0, 1);
	expect(() => validateInquiry(draft)).toThrow("至少需要两人");
	draft.content.inquirers = inquiryFixture().content.inquirers.map((p) => ({
		...p,
		isRecorder: false,
	}));
	expect(() => validateInquiry(draft)).toThrow("请选择一位记录人");
	draft.content.inquirers = draft.content.inquirers.map((p) => ({
		...p,
		isRecorder: true,
	}));
	expect(() => validateInquiry(draft)).toThrow("最多只能选择一位记录人");
});
test("时间和其他关系在服务端验证；重复问答标识和超大正文不能保存", () => {
	const draft = inquiryFixture();
	draft.status = "final";
	draft.content.inquiryEndAt = "2026-11-04T08:00";
	expect(() => validateInquiry(draft)).toThrow("结束时间");
	draft.content.inquiryEndAt = "2026-02-30T10:00";
	expect(() => validateInquiry(draft)).toThrow("有效的询问时间");
	draft.content.inquiryEndAt = "2026-11-04T10:00";
	draft.content.subjectRelationshipOther = " ";
	expect(() => validateInquiry(draft)).toThrow("关系的详细说明");
	draft.status = "draft";
	draft.content.qaItems = [
		draft.content.qaItems[0],
		draft.content.qaItems[0],
	].filter((v) => !!v);
	expect(() => validateInquiry(draft)).toThrow("标识重复");
	draft.content.qaItems = [
		{ id: crypto.randomUUID(), question: "问", answer: "长".repeat(500_001) },
	];
	expect(() => validateInquiry(draft)).toThrow("过长");
});
test("Word 保留长问答、换行、首续页和签字栏，内容无法注入 XML", () => {
	const draft = inquiryFixture();
	const text = `<script>测试 & 内容</script>\n${"长回答。".repeat(2000)}末尾标记`;
	draft.content.qaItems = [
		{ id: crypto.randomUUID(), question: "问题", answer: text },
	];
	const zip = new PizZip(createInquiryDocx(draft));
	const main = zip.file("word/document.xml")?.asText() ?? "";
	expect(main).toContain("&lt;script&gt;");
	expect(main).not.toContain("<script>");
	expect(main).toContain("<w:br/>");
	expect(main).toContain("末尾标记");
	expect(zip.file("word/header2.xml")?.asText()).toContain("续页");
	expect(zip.file("word/footer1.xml")?.asText()).toContain("签字并押印");
	expect(zip.file("word/header1.xml")?.asText()).toContain("NUMPAGES");
	for (const [name, file] of Object.entries(zip.files)) {
		if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
		expect(() =>
			new DOMParser({
				onError: () => {
					throw new Error(`无效 XML：${name}`);
				},
			}).parseFromString(file.asText(), "text/xml"),
		).not.toThrow();
	}
	expect(inquiryFileName('../测试\n"')).toBe(".._测试__.docx");
});

test("新旧法定代表人关系在 Word 中正确勾选，自动年龄仍保留", () => {
	for (const relationship of ["法人", "法定代表人"]) {
		const draft = inquiryFixture();
		draft.content.subjectRelationship = relationship;
		draft.content.subjectAge = "36";
		const zip = new PizZip(createInquiryDocx(draft));
		const main = zip.file("word/document.xml")?.asText() ?? "";
		expect(main).toContain("☑法定代表人");
		expect(main).not.toContain("☑法人");
		expect(main).toContain("年龄：");
		expect(main).toContain(">36<");
	}
});

test("缺少时分的草稿保留已选日期，Word 仅对未填写部分留空", () => {
	const draft = inquiryFixture();
	draft.content.inquiryStartAt = "2026-11-05";
	draft.content.inquiryEndAt = "2026-11-05T10:30";
	expect(() => validateInquiry(draft)).not.toThrow();
	const main = new PizZip(createInquiryDocx(draft))
		.file("word/document.xml")
		?.asText();
	expect(main).toContain("2026年11月05日　时　分 至 2026年11月05日10时30分");
	draft.content.inquiryEndAt = "";
	expect(
		new PizZip(createInquiryDocx(draft)).file("word/document.xml")?.asText(),
	).toContain("2026年11月05日　时　分 至 　年　月　日　时　分");
	draft.content.inquiryEndAt = "2026-11-05T10:30";
	draft.status = "final";
	expect(() => validateInquiry(draft)).toThrow("有效的询问时间");
});
