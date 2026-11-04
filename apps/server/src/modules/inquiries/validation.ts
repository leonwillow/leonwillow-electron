/**
 * @file 草稿与完成笔录的领域校验。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：复用 haoji 完成条件并在服务端校验询问时间与唯一记录人。
 * 被调用：inquiries 服务、领域测试；调用：输入契约、AccessError。
 * 预期结果：草稿可渐进填写，完成时缺项和时间倒置返回中文 400。
 */
import { AccessError } from "../access/service";
import type { InquiryDraft } from "./model";

export function validateInquiry(draft: InquiryDraft) {
	const { content: c } = draft;
	const fail = (message: string): never => {
		throw new AccessError(400, "INVALID_INQUIRY", message);
	};
	if (JSON.stringify(c).length > 500_000)
		fail("笔录内容过长，请拆分为多份笔录。");
	for (const rows of [c.inquirers, c.qaItems]) {
		if (new Set(rows.map((r) => r.id)).size !== rows.length)
			fail("询问人或问答标识重复，请重新加载。");
	}
	if (c.inquirers.filter((r) => r.isRecorder).length > 1)
		fail("最多只能选择一位记录人。");
	if (draft.status !== "final") return;
	const required = {
		inquiryStartAt: "询问开始时间",
		inquiryEndAt: "询问结束时间",
		inquiryLocation: "询问地点",
		enforcementUnitName: "执法单位名称",
		subjectName: "被询问人姓名",
		subjectGender: "性别",
		subjectIdType: "证件类型",
		subjectIdNumber: "证件号码",
		subjectAddress: "住址",
		subjectOrg: "工作单位",
		subjectRelationship: "与被检查人关系",
	} as const;
	for (const [key, label] of Object.entries(required)) {
		if (!c[key as keyof typeof required].trim()) fail(`请填写${label}。`);
	}
	const validTime = (value: string) => {
		if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(value)) return false;
		const date = new Date(`${value.replace(" ", "T")}:00Z`);
		return (
			Number.isFinite(date.getTime()) &&
			date.toISOString().slice(0, 16) === value.replace(" ", "T")
		);
	};
	if (!validTime(c.inquiryStartAt) || !validTime(c.inquiryEndAt))
		fail("请填写有效的询问时间。");
	if (c.inquiryEndAt.replace(" ", "T") <= c.inquiryStartAt.replace(" ", "T"))
		fail("结束时间必须晚于开始时间。");
	if (c.inquirers.length < 2) fail("询问（调查）人至少需要两人。");
	if (c.inquirers.some((r) => !r.name.trim() || !r.badgeNumber.trim()))
		fail("请填写每位询问人的姓名和检查证号。");
	if (!c.inquirers.some((r) => r.isRecorder)) fail("请选择一位记录人。");
	if (c.subjectRelationship === "其他" && !c.subjectRelationshipOther.trim())
		fail("请填写与被检查人关系的详细说明。");
}
