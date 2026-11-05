/**
 * @file 笔录日期时分、自动年龄与历史关系名称的回归测试。
 * 创建时间：2026-11-04；修改时间：2026-11-05。
 * 版本作用：验证日期时间拆分与范围联动，保留旧笔录及自动年龄规则。
 * 被调用：Bun test；调用：笔录字段默认值、日期时间适配和年龄纯函数。
 * 预期结果：清空、跨日和生日边界正确，旧关系值展示为法定代表人。
 */
import { expect, test } from "bun:test";
import {
	changeInquiryDate,
	changeInquiryEndTime,
	changeInquiryStartTime,
	minimumInquiryEndTime,
	readInquirySchedule,
} from "../src/views/inquiries/inquiry-schedule";
import {
	createInquiryDocument,
	inquiryRelationshipName,
	relationships,
} from "../src/views/inquiries/record-fields";
import { calculateSubjectAge } from "../src/views/inquiries/subject-age";

test("身份证年龄以询问日期计算，生日及无效日期边界保持正确", () => {
	const id = "110101199011050017";
	expect(calculateSubjectAge("2026-11-04", "居民身份证", id)).toBe("35");
	expect(calculateSubjectAge("2026-11-05", "居民身份证", id)).toBe("36");
	expect(calculateSubjectAge("1989-11-05", "居民身份证", id)).toBe("");
	expect(calculateSubjectAge("2026-02-30", "居民身份证", id)).toBe("");
	expect(
		calculateSubjectAge("2026-11-04", "居民身份证", "110101199002300017"),
	).toBe("");
	expect(calculateSubjectAge("2026-11-04", "护照", id)).toBe("");
});

test("新笔录使用法定代表人，历史法人值仍匹配当前选项", () => {
	expect(createInquiryDocument().content.subjectRelationship).toBe(
		"法定代表人",
	);
	expect(relationships).not.toContain("法人");
	expect(inquiryRelationshipName("法人")).toBe("法定代表人");
	expect(inquiryRelationshipName("法定代表人")).toBe("法定代表人");
	expect(inquiryRelationshipName("其他")).toBe("其他");
});

test("拆分日期时保留起止时分，并可按新日期重算年龄", () => {
	const times = {
		inquiryStartAt: "2026-11-04T09:15",
		inquiryEndAt: "2026-11-04T10:30",
	};
	const next = changeInquiryDate(times, "2026-11-05");
	expect(next).toEqual({
		inquiryStartAt: "2026-11-05T09:15",
		inquiryEndAt: "2026-11-05T10:30",
	});
	expect(
		calculateSubjectAge(
			next.inquiryStartAt.slice(0, 10),
			"居民身份证",
			"110101199011050017",
		),
	).toBe("36");
	expect(changeInquiryDate(times, "2026-02-30")).toEqual(times);
});

test("清空开始时分仍保留询问日期，重新填写和空结束时间不会生成默认时间", () => {
	const initial = { inquiryStartAt: "2026-11-04T09:15", inquiryEndAt: "" };
	const empty = changeInquiryStartTime(initial, "");
	expect(empty.inquiryStartAt).toBe("2026-11-04");
	expect(readInquirySchedule(empty)).toMatchObject({
		date: "2026-11-04",
		startTime: "",
		endTime: "",
	});
	expect(changeInquiryStartTime(empty, "10:25")).toEqual({
		inquiryStartAt: "2026-11-04T10:25",
		inquiryEndAt: "",
	});
	expect(changeInquiryEndTime(empty, "11:00").inquiryEndAt).toBe(
		"2026-11-04T11:00",
	);
});

test("同日开始时间联动结束时间，保留时长并限制到当日最后一分钟", () => {
	const initial = {
		inquiryStartAt: "2026-11-04T09:00",
		inquiryEndAt: "2026-11-04T10:00",
	};
	expect(changeInquiryStartTime(initial, "10:30").inquiryEndAt).toBe(
		"2026-11-04T11:30",
	);
	const late = changeInquiryStartTime(initial, "23:58");
	expect(late.inquiryEndAt).toBe("2026-11-04T23:59");
	expect(minimumInquiryEndTime(late)).toBe("23:59");
	expect(changeInquiryEndTime(initial, "").inquiryEndAt).toBe("");
});

test("旧跨日笔录回显和修改开始时间不改写结束日期，更换日期保持跨日偏移", () => {
	const initial = {
		inquiryStartAt: "2024-02-28 23:00",
		inquiryEndAt: "2024-02-29T01:00",
	};
	expect(readInquirySchedule(initial)).toEqual({
		date: "2024-02-28",
		startTime: "23:00",
		endTime: "01:00",
		endDate: "2024-02-29",
	});
	expect(changeInquiryStartTime(initial, "23:30").inquiryEndAt).toBe(
		initial.inquiryEndAt,
	);
	expect(changeInquiryDate(initial, "2026-12-31")).toEqual({
		inquiryStartAt: "2026-12-31T23:00",
		inquiryEndAt: "2027-01-01T01:00",
	});
	expect(minimumInquiryEndTime(initial)).toBeUndefined();
});
