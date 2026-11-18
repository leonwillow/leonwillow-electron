/**
 * @file 笔录表单关系与证件常量及默认值转发。
 * 创建时间：2026-11-04；修改时间：2026-11-18。
 * 版本作用：保持编辑器表单选项常量，复用共享领域默认值工厂。
 * 被调用：笔录编辑器、基础信息与问答表单；调用：@/lib/inquiries。
 * 预期结果：旧关系值平滑展示为法定代表人，新笔录默认值与菜单创建共用同一实现。
 */
export {
	createInquiryDocument,
	emptyInquirer,
	emptyQuestion,
} from "@/lib/inquiry-schedule";

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
