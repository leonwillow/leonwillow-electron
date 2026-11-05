/**
 * @file 笔录领域和 API 测试使用的虚构资料。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：提供独立 UUID 的完整有效输入，不读取任何真实案件。
 * 被调用：inquiries 测试；调用：笔录契约类型。
 * 预期结果：用例之间不共享可变问答和询问人。
 */
import type { InquiryDocument } from "../src/modules/inquiries/model";

export function inquiryFixture(): InquiryDocument {
	return {
		title: "测试询问笔录",
		content: {
			inquiryStartAt: "2026-11-04T09:00",
			inquiryEndAt: "2026-11-04T10:00",
			inquiryCount: 1,
			inquiryLocation: "测试询问室",
			enforcementUnitName: "测试执法单位",
			inquirers: [
				{
					id: crypto.randomUUID(),
					name: "测试询问人甲",
					badgeNumber: "TEST-001",
					isRecorder: true,
				},
				{
					id: crypto.randomUUID(),
					name: "测试询问人乙",
					badgeNumber: "TEST-002",
					isRecorder: false,
				},
			],
			subjectName: "测试被询问人",
			subjectGender: "男",
			subjectAge: "30",
			subjectIdType: "其他",
			subjectIdNumber: "TEST-ID",
			subjectAddress: "测试地址",
			subjectPhone: "",
			subjectOrg: "测试单位",
			subjectPosition: "",
			subjectRelationship: "其他",
			subjectRelationshipOther: "测试关系",
			qaItems: [
				{
					id: crypto.randomUUID(),
					question: "测试问题？",
					answer: "测试回答。",
				},
			],
		},
	};
}
