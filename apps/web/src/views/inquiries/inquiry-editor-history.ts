/**
 * @file 笔录编辑器纯历史栈与单调版本号状态机。
 * 创建时间：2026-11-21；修改时间：2026-11-21。
 * 版本作用：管理撤销/重做与外部重命名同步版本号，避免 future 栈与已保存版本号碰撞。
 * 被调用：use-inquiry-editor.ts、inquiry-editor-history.test.ts；调用：@/lib/inquiries 类型。
 * 预期结果：重命名版本号严格递增且覆盖所有历史帧标题，撤销重做脏状态准确。
 */
import type { InquiryDocument } from "@/lib/inquiries";

export type InquiryEditable = Pick<InquiryDocument, "title" | "content">;

export type InquiryHistorySnapshot = {
	value: InquiryEditable;
	rev: number;
};

export type InquiryHistoryState = {
	past: InquiryHistorySnapshot[];
	present: InquiryHistorySnapshot;
	future: InquiryHistorySnapshot[];
	nextRev: number;
	time: number;
};

export type InquiryHistoryAction =
	| { type: "edit"; value: InquiryEditable; time: number }
	| { type: "undo" | "redo" }
	| { type: "rename"; title: string; syncedRev: number };

/** 计算侧栏改名等外部同步后的单调递增版本号，避免与 future 栈中的历史版本号碰撞。 */
export function nextInquirySyncedRev(nextRev: number, currentRev: number) {
	return Math.max(nextRev, currentRev) + 1;
}

export function inquiryHistoryReducer(
	state: InquiryHistoryState,
	action: InquiryHistoryAction,
): InquiryHistoryState {
	if (action.type === "rename") {
		const updateTitle = (
			snap: InquiryHistorySnapshot,
		): InquiryHistorySnapshot => ({
			rev: snap.rev,
			value: { ...snap.value, title: action.title },
		});
		const syncedRev = Math.max(action.syncedRev, state.nextRev + 1);
		return {
			...state,
			past: state.past.map(updateTitle),
			present: {
				rev: syncedRev,
				value: { ...state.present.value, title: action.title },
			},
			future: state.future.map(updateTitle),
			nextRev: syncedRev,
		};
	}
	if (action.type === "edit") {
		if (
			Object.is(action.value, state.present.value) ||
			(action.value.title === state.present.value.title &&
				Object.is(action.value.content, state.present.value.content))
		) {
			return state;
		}
		const rev = state.nextRev + 1;
		return {
			past:
				action.time - state.time > 400 || !state.past.length
					? [...state.past, state.present].slice(-100)
					: state.past,
			present: { value: action.value, rev },
			future: [],
			nextRev: rev,
			time: action.time,
		};
	}
	if (action.type === "undo") {
		const prev = state.past.at(-1);
		return prev
			? {
					past: state.past.slice(0, -1),
					present: prev,
					future: [state.present, ...state.future],
					nextRev: state.nextRev,
					time: 0,
				}
			: state;
	}
	const next = state.future[0];
	return next
		? {
				past: [...state.past, state.present],
				present: next,
				future: state.future.slice(1),
				nextRev: state.nextRev,
				time: 0,
			}
		: state;
}
