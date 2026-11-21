/**
 * @file 笔录编辑器历史栈与侧栏重命名版本号单调性回归测试。
 * 创建时间：2026-11-21；修改时间：2026-11-21。
 * 版本作用：验证撤销→侧栏改名→重做流程不会产生 rev 碰撞导致脏状态失效。
 * 被调用：bun run test:ui；调用：inquiryHistoryReducer、nextInquirySyncedRev、createInquiryDocument。
 * 预期结果：重命名分配的 syncedRev 严格大于所有历史帧，重做回先前未保存内容仍保持 dirty=true。
 */
import { expect, test } from "bun:test";
import {
	type InquiryHistoryState,
	inquiryHistoryReducer,
	nextInquirySyncedRev,
} from "../src/views/inquiries/inquiry-editor-history";
import { createInquiryDocument } from "../src/views/inquiries/record-fields";

test("撤销后侧栏改名再重做不发生 rev 碰撞，重做内容保持脏状态", () => {
	const base = createInquiryDocument();
	let state: InquiryHistoryState = {
		past: [],
		present: { value: { title: "初稿", content: base.content }, rev: 0 },
		future: [],
		nextRev: 0,
		time: 0,
	};
	const v1 = {
		title: "初稿",
		content: { ...base.content, inquiryLocation: "会议室 A" },
	};
	const v2 = {
		title: "初稿",
		content: { ...base.content, inquiryLocation: "会议室 B" },
	};
	const v3 = {
		title: "初稿",
		content: { ...base.content, inquiryLocation: "会议室 C" },
	};

	state = inquiryHistoryReducer(state, { type: "edit", value: v1, time: 1000 });
	state = inquiryHistoryReducer(state, { type: "edit", value: v2, time: 2000 });
	state = inquiryHistoryReducer(state, { type: "edit", value: v3, time: 3000 });
	expect(state.present.rev).toBe(3);
	expect(state.nextRev).toBe(3);

	// 撤销一步：present 为 v2 (rev=2)，future 顶部为 v3 (rev=3)
	state = inquiryHistoryReducer(state, { type: "undo" });
	expect(state.present.rev).toBe(2);
	expect(state.future[0]?.rev).toBe(3);

	// 侧栏改名：分配严格大于 nextRev 的版本号（4），不能与 future[0].rev (3) 碰撞
	const syncedRev = nextInquirySyncedRev(state.nextRev, state.present.rev);
	expect(syncedRev).toBe(4);
	state = inquiryHistoryReducer(state, {
		type: "rename",
		title: "重命名后笔录",
		syncedRev,
	});
	const savedRev = syncedRev;
	expect(state.present.rev).toBe(4);
	expect(state.present.value.title).toBe("重命名后笔录");
	expect(state.future[0]?.rev).toBe(3);
	expect(state.future[0]?.value.title).toBe("重命名后笔录");

	// 重做回 v3：rev=3 !== savedRev(4)，必须仍为脏状态触发保存
	state = inquiryHistoryReducer(state, { type: "redo" });
	expect(state.present.value.content.inquiryLocation).toBe("会议室 C");
	expect(state.present.rev).toBe(3);
	expect(state.present.rev !== savedRev).toBe(true);

	// 再次撤销回改名后的已保存版本：rev=4 === savedRev，清除脏状态
	state = inquiryHistoryReducer(state, { type: "undo" });
	expect(state.present.rev).toBe(savedRev);
});
