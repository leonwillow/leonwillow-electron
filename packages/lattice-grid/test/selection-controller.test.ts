/**
 * @file 多区域选择、指针拖选生命周期与剪贴板提示的控制器回归。
 * 创建时间：2026-11-17；修改时间：2026-11-17。
 * 版本作用：使用真实 GridStore、GridView 和最小文档事件宿主验证用户交互。
 * 被调用：bun test；调用：选择控制器、核心状态及中文消息。
 * 预期结果：指针结束后不再扩选，追加区域与统计一致，多区剪贴板不会静默丢弃区域。
 */
import { describe, expect, it } from "bun:test";
import { createGrid, selectionBounds } from "../src/core";
import { zhCN } from "../src/core/messages";
import { GridView } from "../src/view-controller";

const target = { closest: () => null };
const position = (row = 0, columnId = "value") => ({
	rowId: String(row),
	columnId,
});
function pointer(patch: Partial<PointerEvent> = {}) {
	return {
		button: 0,
		buttons: 1,
		pointerId: 1,
		pointerType: "mouse",
		isPrimary: true,
		clientX: 178,
		clientY: 148,
		shiftKey: false,
		ctrlKey: false,
		metaKey: false,
		target,
		preventDefault() {},
		stopPropagation() {},
		...patch,
	} as PointerEvent;
}
function keyboard(key: string, patch: Partial<KeyboardEvent> = {}) {
	return { key, target, preventDefault() {}, ...patch } as KeyboardEvent;
}

/** DOM 只提供滚动口几何与原生 EventTarget；故意不提供单元格 DOM，覆盖虚拟行卸载。 */
function fixture(count = 4) {
	const store = createGrid({
		rows: Array.from({ length: count }, (_, i) => ({
			id: String(i),
			value: i + 1,
			calculated: (i + 1) * 10,
		})),
		columns: [
			{ id: "value", field: "value", header: "金额", type: "number" },
			{
				id: "calculated",
				field: "calculated",
				header: "计算值",
				type: "number",
				editable: false,
			},
		],
		getRowId: (row) => row.id,
	});
	class Observer {
		observe() {}
		disconnect() {}
	}
	const win = Object.assign(new EventTarget(), {
		ResizeObserver: Observer,
		MutationObserver: Observer,
		getComputedStyle: () => ({ getPropertyValue: () => "", fontSize: "16px" }),
	});
	const doc = Object.assign(new EventTarget(), {
		defaultView: win,
		documentElement: {},
	});
	let scrollTop = 0;
	let scrollLeft = 0;
	const scroller = {
		clientWidth: 420,
		clientHeight: 320,
		get scrollTop() {
			return scrollTop;
		},
		set scrollTop(value: number) {
			scrollTop = Math.max(0, Math.min(count * 32 + 68 - 320, value));
		},
		get scrollLeft() {
			return scrollLeft;
		},
		set scrollLeft(value: number) {
			scrollLeft = Math.max(0, value);
		},
		getBoundingClientRect: () => ({
			left: 50,
			top: 100,
			right: 470,
			bottom: 420,
			width: 420,
			height: 320,
		}),
		focus() {},
	};
	const root = { ownerDocument: doc, querySelector: () => null };
	const view = new GridView(store, {
		id: "selection-controller",
		messages: zhCN,
	});
	view.root = root as unknown as HTMLElement;
	view.scroller = scroller as unknown as HTMLElement;
	const cleanup = view.mount();
	const dispatch = (type: string, patch: Partial<PointerEvent> = {}) => {
		const event = new Event(type);
		const { target: _target, ...data } = pointer(patch);
		Object.assign(event, data);
		doc.dispatchEvent(event);
	};
	const bounds = () => {
		const snapshot = store.getSnapshot();
		return selectionBounds(
			snapshot.state,
			snapshot.viewRows,
			snapshot.columns,
			store.getOptions().getRowId,
		);
	};
	return { store, view, scroller, win, dispatch, cleanup, bounds };
}

describe("多区域选择展示与键盘", () => {
	it("右键命中判定覆盖全部区域，间隔与失效行列不会误判为已选中", () => {
		const f = fixture();
		try {
			f.view.select(position());
			f.view.select(position(1, "calculated"), true);
			f.view.select(position(3), false, true);
			const state = f.store.getSnapshot().state;
			expect(f.view.isSelected(position(0, "calculated"))).toBe(true);
			expect(f.view.isSelected(position(3))).toBe(true);
			expect(f.view.isSelected(position(2))).toBe(false);
			expect(f.view.isSelected(position(3, "calculated"))).toBe(false);
			expect(f.view.isSelected(position(999))).toBe(false);
			expect(f.store.getSnapshot().state).toBe(state);
			f.store.setColumn("calculated", { hidden: true });
			expect(f.view.isSelected(position(0, "calculated"))).toBe(false);
			expect(f.view.isSelected(position(3))).toBe(true);
		} finally {
			f.cleanup();
		}
	});
	it("Ctrl/Cmd 追加，Shift 仅扩展活动区域，普通选择替换全部区域", () => {
		const f = fixture();
		try {
			f.view.startSelection(pointer(), position());
			f.dispatch("pointerup", { buttons: 0 });
			f.view.startSelection(pointer({ ctrlKey: true }), position(1));
			f.dispatch("pointerup", { buttons: 0 });
			f.view.startSelection(pointer({ metaKey: true }), position(2));
			f.dispatch("pointerup", { buttons: 0 });
			expect(f.bounds()).toHaveLength(3);
			f.view.startSelection(
				pointer({ shiftKey: true }),
				position(3, "calculated"),
			);
			f.dispatch("pointerup", { buttons: 0 });
			expect(f.store.getSnapshot().state.selection?.anchor).toEqual(
				position(2),
			);
			expect(
				f.store
					.getSnapshot()
					.state.additionalSelections?.map((range) => range.focus),
			).toEqual([position(), position(1)]);
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(
				position(3, "calculated"),
			);
			expect(f.bounds()[2]).toEqual({
				r0: 2,
				r1: 3,
				c0: 0,
				c1: 1,
			});
			f.view.startSelection(pointer(), position(1, "calculated"));
			expect(f.bounds()).toEqual([{ r0: 1, r1: 1, c0: 1, c1: 1 }]);
		} finally {
			f.cleanup();
		}
	});
	it("统计去重重叠区域，地址包含全部区域，额外区域变化使缓存失效", () => {
		const f = fixture();
		try {
			f.view.select(position());
			f.view.select(position(1, "calculated"), true);
			f.view.select(position(1), false, true);
			f.view.select(position(2), true);
			expect(f.view.stats()).toEqual({ count: 5, sum: 36, numericCount: 5 });
			expect(f.view.address()).toBe("A1:B2, A2:A3");
			const before = f.view.stats();
			f.store.setState({ additionalSelections: [] }, "selection");
			expect(f.view.stats()).not.toBe(before);
			expect(f.view.stats()).toEqual({ count: 2, sum: 5, numericCount: 2 });
		} finally {
			f.cleanup();
		}
	});
	it("方向键从活动终点导航，Shift 扩展保留其他区，全选与 Escape 清理额外区", () => {
		const f = fixture();
		try {
			f.view.select(position());
			f.view.select(position(1), false, true);
			f.view.onKeyDown(keyboard("ArrowDown", { shiftKey: true }));
			expect(f.store.getSnapshot().state.selection).toEqual({
				anchor: position(1),
				focus: position(2),
			});
			expect(f.bounds()).toHaveLength(2);
			f.view.onKeyDown(keyboard("ArrowRight"));
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(
				position(2, "calculated"),
			);
			expect(f.bounds()).toHaveLength(1);
			f.view.select(position(), false, true);
			f.view.onKeyDown(keyboard("a", { metaKey: true }));
			expect(f.bounds()).toEqual([{ r0: 0, r1: 3, c0: 0, c1: 1 }]);
			expect(f.store.getSnapshot().state.additionalSelections).toEqual([]);
			f.view.onKeyDown(keyboard("Escape"));
			expect(f.bounds()).toEqual([]);
			expect(f.store.getSnapshot().state.additionalSelections).toEqual([]);
		} finally {
			f.cleanup();
		}
	});
});

describe("拖选指针生命周期", () => {
	it("点击保持动画；扩展仅跟随同一指针，往返锚点也保持拖选直到释放", () => {
		const f = fixture();
		try {
			f.view.startSelection(pointer(), position());
			expect(f.view.getSnapshot().selecting).toBe(false);
			f.dispatch("pointermove");
			expect(f.view.getSnapshot().selecting).toBe(false);
			f.dispatch("pointermove", { pointerId: 2, clientY: 180 });
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(position());
			f.dispatch("pointermove", { clientY: 180, clientX: 338 });
			expect(f.view.getSnapshot().selecting).toBe(true);
			expect(f.bounds()).toEqual([{ r0: 0, r1: 1, c0: 0, c1: 1 }]);
			f.dispatch("pointerup", { pointerId: 2, buttons: 0 });
			expect(f.view.getSnapshot().selecting).toBe(true);
			f.dispatch("pointermove");
			expect(f.view.getSnapshot().selecting).toBe(true);
			f.dispatch("pointerup", { buttons: 0 });
			expect(f.view.getSnapshot().selecting).toBe(false);
			f.dispatch("pointermove", { clientY: 212 });
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(position());
		} finally {
			f.cleanup();
		}
	});
	it("Ctrl 拖选只扩展新区域，释放补齐最终位置", () => {
		const f = fixture();
		try {
			f.view.select(position());
			f.view.startSelection(
				pointer({ ctrlKey: true, clientY: 180 }),
				position(1),
			);
			f.dispatch("pointermove", { clientY: 212, clientX: 338 });
			f.dispatch("pointerup", { clientY: 244, clientX: 338, buttons: 0 });
			expect(f.bounds()).toEqual([
				{ r0: 0, r1: 0, c0: 0, c1: 0 },
				{ r0: 1, r1: 3, c0: 0, c1: 1 },
			]);
			expect(f.view.getSnapshot().selecting).toBe(false);
		} finally {
			f.cleanup();
		}
	});
	for (const end of [
		"pointercancel",
		"buttons",
		"blur",
		"unmount",
		"escape",
	] as const) {
		it(`${end} 后不再扩选或保留拖选标记`, () => {
			const f = fixture();
			try {
				f.view.startSelection(pointer(), position());
				f.dispatch("pointermove", { clientY: 180 });
				if (end === "pointercancel") f.dispatch("pointercancel");
				if (end === "buttons") f.dispatch("pointermove", { buttons: 0 });
				if (end === "blur") f.win.dispatchEvent(new Event("blur"));
				if (end === "unmount") f.cleanup();
				if (end === "escape") f.view.onKeyDown(keyboard("Escape"));
				const selection = f.store.getSnapshot().state.selection;
				f.dispatch("pointermove", { clientY: 212 });
				expect(f.store.getSnapshot().state.selection).toEqual(selection);
				expect(f.view.getSnapshot().selecting).toBe(false);
			} finally {
				f.cleanup();
			}
		});
	}
	it("触摸保留滚动，次按钮与输入子控件不发起选择", () => {
		const f = fixture();
		try {
			f.view.startSelection(pointer({ pointerType: "touch" }), position());
			f.dispatch("pointermove", { clientY: 180 });
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(position());
			f.view.startSelection(pointer({ button: 2 }), position(1));
			f.view.startSelection(pointer({ isPrimary: false }), position(1));
			f.view.startSelection(
				pointer({ target: { closest: () => ({}) } as unknown as HTMLElement }),
				position(1),
			);
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(position());
		} finally {
			f.cleanup();
		}
	});
	it("滚动后的虚拟行和冻结列按几何定位，不依赖已卸载的单元格 DOM", () => {
		const f = fixture(500);
		try {
			f.store.setColumn("value", { pinned: true });
			f.scroller.scrollTop = 3200;
			f.scroller.scrollLeft = 60;
			f.view.startSelection(pointer(), position(100));
			f.dispatch("pointermove", { clientX: 298, clientY: 180 });
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(
				position(101, "calculated"),
			);
			f.dispatch("pointermove", { clientX: 178, clientY: 212 });
			expect(f.store.getSnapshot().state.selection?.focus).toEqual(
				position(102),
			);
		} finally {
			f.cleanup();
		}
	});
});

describe("多区剪贴板和清除", () => {
	it("复制和粘贴明确提示单一区域，不写剪贴板、不改任何值", async () => {
		const f = fixture();
		try {
			f.view.select(position());
			f.view.select(position(2), false, true);
			let writes = 0;
			let prevented = 0;
			const event = {
				target,
				clipboardData: { setData: () => writes++, getData: () => "99" },
				preventDefault: () => prevented++,
			} as unknown as ClipboardEvent;
			f.view.onCopy(event);
			expect(f.view.getSnapshot().notice).toBe(
				zhCN.multipleSelectionsClipboard,
			);
			f.view.onPaste(event);
			await f.view.copy();
			expect(prevented).toBe(2);
			expect(writes).toBe(0);
			expect(f.store.getSnapshot().rows.map((row) => row.value)).toEqual([
				1, 2, 3, 4,
			]);
			expect(f.store.getSnapshot().canUndo).toBe(false);
		} finally {
			f.cleanup();
		}
	});
	it("Delete 清除所有可编辑区域且保留间隔格，一次撤销恢复全部", async () => {
		const f = fixture();
		try {
			f.view.select(position());
			f.view.select(position(2), false, true);
			f.view.onKeyDown(keyboard("Delete"));
			await Bun.sleep(0);
			expect(f.store.getSnapshot().rows[0]?.value).toBeNull();
			expect(f.store.getSnapshot().rows[1]?.value).toBe(2);
			expect(f.store.getSnapshot().rows[2]?.value).toBeNull();
			expect(f.store.getSnapshot().rows[3]?.value).toBe(4);
			await f.store.undo();
			expect(f.store.getSnapshot().rows.map((row) => row.value)).toEqual([
				1, 2, 3, 4,
			]);
		} finally {
			f.cleanup();
		}
	});
});
