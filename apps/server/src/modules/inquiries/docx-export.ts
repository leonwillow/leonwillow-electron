/**
 * @file 使用现有 PizZip 生成可编辑的询问笔录 Word 文件。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：沿用 haoji 的 A4、仿宋、首续页、签字栏和动态页码规则。
 * 被调用：inquiries 下载接口、导出测试；调用：PizZip、笔录契约。
 * 预期结果：字段保持文本可编辑，用户文本只进入转义后的 XML，不执行表达式。
 */
import PizZip from "pizzip";
import type { InquiryDocument } from "./model";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const xml = (s: string) =>
	Array.from(s)
		.filter((c) => {
			const n = c.codePointAt(0) ?? 0;
			return (
				n === 9 ||
				n === 10 ||
				n === 13 ||
				(n >= 32 && n <= 0xd7ff) ||
				(n >= 0xe000 && n <= 0xfffd) ||
				n >= 0x10000
			);
		})
		.join("")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
function run(value: string, props = "") {
	return `<w:r><w:rPr><w:rFonts w:ascii="仿宋_GB2312" w:eastAsia="仿宋_GB2312"/>${props.includes("<w:sz ") ? "" : '<w:sz w:val="28"/>'}${props}</w:rPr>${value
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => `<w:t xml:space="preserve">${xml(line)}</w:t>`)
		.join("<w:br/>")}</w:r>`;
}
const p = (runs: string, props = "", line = 470) =>
	`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${line}" w:lineRule="atLeast"/>${props}</w:pPr>${runs}</w:p>`;
const underlined = (s: string) => run(s || "　　", '<w:u w:val="single"/>');
const field = (name: string) =>
	`<w:fldSimple w:instr="${xml(name)}">${run("1")}</w:fldSimple>`;
const paragraph = (label: string, text: string) =>
	p(run(label) + underlined(text));
const dateText = (value: string) => {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value);
	return m
		? `${m[1]}年${m[2]}月${m[3]}日${m[4] ?? "　"}时${m[5] ?? "　"}分`
		: "　年　月　日　时　分";
};
function upperNumber(value: number) {
	const digits = "零壹贰叁肆伍陆柒捌玖";
	const units = ["", "拾", "佰", "仟"];
	let result = "";
	let zero = false;
	for (let i = 3; i >= 0; i--) {
		const d = Math.floor(value / 10 ** i) % 10;
		if (d) {
			result += (zero ? "零" : "") + digits[d] + units[i];
			zero = false;
		} else if (result && value % 10 ** i) zero = true;
	}
	return result || "零";
}
function metadataRow(cells: { label: string; value: string; width: number }[]) {
	return `<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="nil"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${cells.map((c) => `<w:gridCol w:w="${c.width}"/>`).join("")}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${c.width}" w:type="dxa"/><w:tcMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(c.label, c.value)}</w:tc>`).join("")}</w:tr></w:tbl>`;
}
/** 无文件系统或网络依赖；输入为笔录内容，返回标准 DOCX ZIP 字节。 */
export function createInquiryDocx(draft: InquiryDocument) {
	const c = draft.content;
	// 历史笔录使用“法人”存储时，导出仍勾选当前的“法定代表人”。
	const relationship =
		c.subjectRelationship === "法人" ? "法定代表人" : c.subjectRelationship;
	const authority =
		c.enforcementUnitName.trim() || "国家税务总局XXX税务局XXX稽查局";
	const person = (v: (typeof c.inquirers)[number]) =>
		`${v.name}${v.badgeNumber ? `（${v.badgeNumber}）` : ""}`;
	const recorder = c.inquirers.find((v) => v.isRecorder);
	const right = '<w:jc w:val="right"/>';
	const center = '<w:jc w:val="center"/>';
	const counter = p(
		run("共") +
			field("NUMPAGES \\* CHINESENUM2") +
			run("页　第") +
			field("PAGE \\* CHINESENUM2") +
			run("页"),
		right,
	);
	const header = (first: boolean) =>
		`<w:hdr xmlns:w="${W}">${first ? p(run(authority, '<w:sz w:val="40"/>'), center, 480) : ""}${p(run(first ? "询问（调查）笔录" : "询问（调查）笔录续页", '<w:b/><w:sz w:val="52"/>'), center, 560)}${first ? p(run(`（第${upperNumber(c.inquiryCount)}次）`), right) : p(run(""))}${counter}</w:hdr>`;
	const footer = `<w:ftr xmlns:w="${W}">${p(run("询问（调查）人签字：　　　　　　　记录人签字："), "", 634)}${p(run("被询问（调查）人签字并押印：　　　　　年　月　日"), "", 634)}${p(run("— ") + field("PAGE") + run(" —"), right)}</w:ftr>`;
	const full = (label: string, value: string) =>
		metadataRow([{ label, value, width: 9072 }]);
	const body = [
		full(
			"时　间：",
			`${dateText(c.inquiryStartAt)} 至 ${dateText(c.inquiryEndAt)}`,
		),
		full("地　点：", c.inquiryLocation),
		...c.inquirers.map((r, i) =>
			full(i === 0 ? "询问（调查）人：" : "　　　　　　　　", person(r)),
		),
		full("记录人：", recorder ? person(recorder) : ""),
		metadataRow([
			{ label: "被询问（调查）人：", value: c.subjectName, width: 5500 },
			{ label: "性别：", value: c.subjectGender, width: 1700 },
			{ label: "年龄：", value: c.subjectAge, width: 1872 },
		]),
		metadataRow([
			{ label: "证件种类：", value: c.subjectIdType, width: 4200 },
			{ label: "证件号码：", value: c.subjectIdNumber, width: 4872 },
		]),
		full("工作单位：", c.subjectOrg),
		metadataRow([
			{ label: "职务：", value: c.subjectPosition, width: 4200 },
			{ label: "联系电话：", value: c.subjectPhone, width: 4872 },
		]),
		full("住址：", c.subjectAddress),
		full(
			"与被检查人关系：",
			["法定代表人", "实际控制人", "财务负责人", "办税人", "税务代理人", "其他"]
				.map(
					(v) =>
						`${relationship === v ? "☑" : "☐"}${v}${v === "其他" && relationship === v ? `：${c.subjectRelationshipOther}` : ""}`,
				)
				.join("　"),
		),
		paragraph(
			"询问人：",
			`您好！我们是${authority}的税务执法人员，这是我们的税务检查证（出示税务检查证），请您确认。`,
		),
		paragraph("被询问人：", "□已确认/□不确认"),
		paragraph(
			"询问人：",
			"现依法就（被检查人、具体事由）有关情况进行询问，请如实回答问题。如不如实回答问题，将承担相应法律后果。您有权进行陈述和申辩。",
		),
		...c.qaItems.flatMap((qa) => [
			p(run("问：") + underlined(qa.question), "", 634),
			p(run("答：") + underlined(qa.answer), "", 634),
		]),
	].join("");
	const zip = new PizZip();
	const partNames = [
		"document",
		"styles",
		"settings",
		"header1",
		"header2",
		"footer1",
	];
	zip.file(
		"[Content_Types].xml",
		`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${partNames.map((name) => `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${name === "document" ? "document.main" : name.replace(/\d/, "")}+xml"/>`).join("")}</Types>`,
	);
	zip.file(
		"_rels/.rels",
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
	);
	zip.file(
		"word/_rels/document.xml.rels",
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${partNames
			.slice(1)
			.map(
				(name) =>
					`<Relationship Id="${name}" Type="${R}/${name.replace(/\d/, "")}" Target="${name}.xml"/>`,
			)
			.join("")}</Relationships>`,
	);
	zip.file(
		"word/document.xml",
		`<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}<w:sectPr><w:headerReference w:type="first" r:id="header1"/><w:headerReference w:type="default" r:id="header2"/><w:footerReference w:type="first" r:id="footer1"/><w:footerReference w:type="default" r:id="footer1"/><w:titlePg/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="3600" w:right="1417" w:bottom="2300" w:left="1417" w:header="1304" w:footer="360"/></w:sectPr></w:body></w:document>`,
	);
	zip.file(
		"word/styles.xml",
		`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="仿宋_GB2312" w:eastAsia="仿宋_GB2312"/><w:sz w:val="28"/><w:lang w:val="zh-CN"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
	);
	zip.file(
		"word/settings.xml",
		`<w:settings xmlns:w="${W}"><w:updateFields w:val="true"/></w:settings>`,
	);
	zip.file("word/header1.xml", header(true));
	zip.file("word/header2.xml", header(false));
	zip.file("word/footer1.xml", footer);
	return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

export function inquiryFileName(title: string) {
	return `${
		title
			.trim()
			.replace(/[\\/:*?"<>|]/g, "_")
			.split("")
			.map((c) => (c.charCodeAt(0) < 32 ? "_" : c))
			.join("")
			.slice(0, 80) || "询问调查笔录"
	}.docx`;
}
