/**
 * @file 笔录表单关系与证件常量、默认值转发及表单与文书预览定位映射。
 * 创建时间：2026-11-04；修改时间：2026-11-21。
 * 版本作用：保持编辑器表单选项常量，复用共享领域默认值工厂，并集中维护表单控件 ID 到文书预览目标的纯函数映射。
 * 被调用：笔录编辑器、基础信息与问答表单、文书分页预览；调用：@/lib/inquiries。
 * 预期结果：旧关系值平滑展示为法定代表人，表单字段与文书预览双向联动覆盖全部基础字段与问答组。
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

/** 将左侧基础信息或中间问答表单的控件 ID 映射为右侧文书预览中对应元素的 data-preview-target 列表。 */
export function resolvePreviewTargetsForField(fieldId: string): string[] {
	const id = fieldId.trim().replace(/-value$/, "");
	if (!id) return [];
	if (id === "inquiry-enforcementUnitName") {
		return ["inquiry-enforcementUnitName"];
	}
	if (id === "inquiry-inquiryCount") {
		return ["inquiry-inquiryCount"];
	}
	if (
		id === "inquiry-date" ||
		id === "inquiry-inquiryStartAt" ||
		id === "inquiry-inquiryEndAt"
	) {
		return ["inquiry-inquiryStartAt"];
	}
	if (id === "inquiry-inquiryLocation") {
		return ["inquiry-inquiryLocation"];
	}
	if (id === "inquiry-subjectName" || id === "inquiry-subjectGender") {
		return ["inquiry-subjectName"];
	}
	if (id === "inquiry-subjectIdType" || id === "inquiry-subjectIdNumber") {
		return ["inquiry-subjectIdNumber"];
	}
	if (id === "inquiry-subjectOrg") {
		return ["inquiry-subjectOrg"];
	}
	if (id === "inquiry-subjectPosition" || id === "inquiry-subjectPhone") {
		return ["inquiry-subjectPosition"];
	}
	if (id === "inquiry-subjectAddress") {
		return ["inquiry-subjectAddress"];
	}
	if (
		id === "inquiry-subjectRelationship" ||
		id === "inquiry-subjectRelationshipOther"
	) {
		return ["inquiry-subjectRelationship"];
	}
	if (id.startsWith("inquirer-name-")) {
		return [id];
	}
	if (id.startsWith("inquirer-badge-")) {
		return [`inquirer-name-${id.slice("inquirer-badge-".length)}`];
	}
	if (id.startsWith("frequent-")) {
		return [`inquirer-name-${id.slice("frequent-".length)}`];
	}
	if (id.startsWith("recorder-")) {
		return ["inquiry-recorder"];
	}
	if (id.startsWith("question-") || id.startsWith("answer-")) {
		return [id];
	}
	if (id.startsWith("group-")) {
		const qaId = id.slice("group-".length);
		return qaId ? [`question-${qaId}`, `answer-${qaId}`] : [];
	}
	return [];
}
