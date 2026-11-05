/**
 * @file 将询问日期与起止时分适配到已有笔录时间字段。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：保持本地日期字符串，复用 ReUI 时间范围的时长联动规则。
 * 被调用：基础信息表单、字段测试；调用：标准日期函数和笔录类型。
 * 预期结果：日期和时分可分别编辑，清空时分不丢日期，历史跨日记录不被静默改写。
 */
import type { InquiryContent } from "@/lib/inquiries";

type InquiryTimes = Pick<InquiryContent, "inquiryStartAt" | "inquiryEndAt">;
const dayLength = 86_400_000;

function dateValue(date: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
	const value = Date.parse(`${date}T00:00:00Z`);
	return Number.isFinite(value) &&
		new Date(value).toISOString().slice(0, 10) === date
		? value
		: Number.NaN;
}

function split(value: string) {
	const match = /^(\d{4}-\d{2}-\d{2})(?:[ T]([01]\d|2[0-3]):([0-5]\d))?$/.exec(
		value,
	);
	if (!match || !Number.isFinite(dateValue(match[1] ?? "")))
		return { date: "", time: "" };
	return {
		date: match[1] ?? "",
		time: match[2] ? `${match[2]}:${match[3]}` : "",
	};
}

const minutes = (time: string) =>
	Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const formatTime = (value: number) =>
	`${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const combine = (date: string, time: string) =>
	date && time ? `${date}T${time}` : date;

export function readInquirySchedule(content: InquiryTimes) {
	const start = split(content.inquiryStartAt);
	const end = split(content.inquiryEndAt);
	return {
		date: start.date || end.date,
		startTime: start.time,
		endTime: end.time,
		endDate: end.date,
	};
}

/** 只接受真实日历日期；跨日旧笔录保留原来的结束日期偏移。 */
export function changeInquiryDate(
	content: InquiryTimes,
	date: string,
): InquiryTimes {
	const nextDate = dateValue(date);
	if (!Number.isFinite(nextDate)) return content;
	const current = readInquirySchedule(content);
	const offset =
		(dateValue(current.endDate) - dateValue(current.date)) / dayLength;
	const endDate =
		Number.isFinite(offset) && offset > 0
			? new Date(nextDate + offset * dayLength).toISOString().slice(0, 10)
			: date;
	return {
		inquiryStartAt: combine(date, current.startTime),
		inquiryEndAt: current.endTime ? combine(endDate, current.endTime) : "",
	};
}

/** 同日已有起止时间随开始时间平移，最晚到23:59；空结束时间保持待填写。 */
export function changeInquiryStartTime(
	content: InquiryTimes,
	time: string,
): InquiryTimes {
	const current = readInquirySchedule(content);
	if (!current.date || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
		return content;
	let end = content.inquiryEndAt;
	if (time && current.endTime && current.endDate === current.date) {
		const start = minutes(time);
		const shift = current.startTime ? start - minutes(current.startTime) : 0;
		const nextEnd = Math.min(
			1439,
			Math.max(minutes(current.endTime) + shift, start + 1),
		);
		end = combine(current.date, formatTime(nextEnd));
	}
	return { inquiryStartAt: combine(current.date, time), inquiryEndAt: end };
}

export function changeInquiryEndTime(
	content: InquiryTimes,
	time: string,
): InquiryTimes {
	const current = readInquirySchedule(content);
	if (!current.date || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
		return content;
	return {
		inquiryStartAt: content.inquiryStartAt,
		inquiryEndAt: time ? combine(current.endDate || current.date, time) : "",
	};
}

export function minimumInquiryEndTime(content: InquiryTimes) {
	const current = readInquirySchedule(content);
	if (
		!current.startTime ||
		(current.endDate && current.endDate !== current.date)
	)
		return undefined;
	return formatTime(Math.min(1439, minutes(current.startTime) + 1));
}
