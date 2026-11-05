/**
 * @file 笔录统一保存流程的内容一致性校验。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：允许逐步填写，校验已提供的时间、唯一标识和记录人。
 * 被调用：inquiries 服务、领域测试；调用：输入契约、AccessError。
 * 预期结果：未填写字段可以保存，非法内容和时间倒置返回中文 400。
 */
import { AccessError } from "../access/service";
import type { InquiryDocument } from "./model";

/** 校验待保存内容；允许空值和仅日期，内容不一致时抛出 INVALID_INQUIRY。 */
export function validateInquiry(document: InquiryDocument) {
	const { content: c } = document;
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
	const validTime = (value: string) => {
		if (!value) return true;
		if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?$/.test(value)) return false;
		const normalized = value.replace(" ", "T");
		const date = new Date(
			value.length === 10 ? `${value}T00:00:00Z` : `${normalized}:00Z`,
		);
		return (
			Number.isFinite(date.getTime()) &&
			date.toISOString().slice(0, value.length) === normalized
		);
	};
	if (!validTime(c.inquiryStartAt) || !validTime(c.inquiryEndAt))
		fail("请填写有效的询问时间。");
	if (
		c.inquiryStartAt.length === 16 &&
		c.inquiryEndAt.length === 16 &&
		c.inquiryEndAt.replace(" ", "T") <= c.inquiryStartAt.replace(" ", "T")
	)
		fail("结束时间必须晚于开始时间。");
}
