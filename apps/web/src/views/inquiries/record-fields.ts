/**
 * @file 新笔录的默认值与编辑纯函数。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：沿用 haoji 默认字段和独立问答/询问人标识。
 * 被调用：笔录创建、编辑器、问答表单；调用：浏览器 UUID、Eden 类型。
 * 预期结果：首次创建已保存的笔录，时间使用本地日期，不生成假人员资料。
 */
import type { InquiryDocument } from "@/lib/inquiries";
export const relationships = [
	"法定代表人",
	"实际控制人",
	"财务负责人",
	"办税人",
	"税务代理人",
	"其他",
];
/** 旧笔录保留可读性；编辑或选择关系时使用当前称呼。 */
export const inquiryRelationshipName = (value: string) =>
	value === "法人" ? "法定代表人" : value;
export const idTypes = [
	"居民身份证",
	"护照",
	"外国人永久居留身份证",
	"港澳居民来往内地通行证",
	"台湾居民来往大陆通行证",
	"其他",
];
export const emptyInquirer = () => ({
	id: crypto.randomUUID(),
	name: "",
	badgeNumber: "",
	isRecorder: false,
});
export const emptyQuestion = () => ({
	id: crypto.randomUUID(),
	question: "",
	answer: "",
});
export function createInquiryDocument(): InquiryDocument {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return {
		title: `询问笔录 ${date}`,
		content: {
			inquiryStartAt: `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
			inquiryEndAt: "",
			inquiryCount: 1,
			inquiryLocation: "",
			enforcementUnitName: "国家税务总局XXX税务局XXX稽查局",
			inquirers: [emptyInquirer(), emptyInquirer()],
			subjectName: "",
			subjectGender: "男",
			subjectAge: "",
			subjectIdType: "居民身份证",
			subjectIdNumber: "",
			subjectAddress: "",
			subjectPhone: "",
			subjectOrg: "",
			subjectPosition: "",
			subjectRelationship: "法定代表人",
			subjectRelationshipOther: "",
			qaItems: [emptyQuestion()],
		},
	};
}
