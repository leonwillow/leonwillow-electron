/**
 * @file 图谱分批绘制的完整性、取消与历史坐标回归。
 * 创建时间：2026-10-07
 * 修改时间：2026-10-07
 * 版本作用：防止分批丢失交易、离开案件仍写入旧画布或重算历史位置。
 * 被调用：bun test；调用：funds-graph-batches / funds-graph-layout。
 * 预期结果：全部项目恰好一次、有让出执行权、取消后不继续绘制。
 */
import { expect, test } from "bun:test";
import { drawInBatches } from "../src/lib/funds-graph-batches";
import { fundsNodePositions } from "../src/lib/funds-graph-layout";

test("整案 7357 条交易依次分批且完整，批次间可处理外部事件", async () => {
	const source = Array.from({ length: 7357 }, (_, index) => index);
	const actual: number[] = [];
	const progress: number[] = [];
	let pending = false;
	let interruptions = 0;
	const events = new MessageChannel();
	events.port1.onmessage = () => {
		pending = true;
	};
	expect(
		await drawInBatches(
			source,
			async (batch) => {
				if (pending) interruptions++;
				actual.push(...batch);
				pending = false;
				events.port2.postMessage(null);
			},
			new AbortController().signal,
			(value) => progress.push(value),
		),
	).toBe(true);
	events.port1.close();
	events.port2.close();
	expect(actual).toEqual(source);
	expect(interruptions).toBeGreaterThan(0);
	expect(progress.at(-1)).toBe(source.length);
});

test("切换案件后取消下一批，预先取消不会写入，失败不报告完成", async () => {
	const controller = new AbortController();
	let draws = 0;
	const done = await drawInBatches(
		Array.from({ length: 1000 }, (_, i) => i),
		async () => {
			draws++;
			controller.abort();
		},
		controller.signal,
	);
	expect(done).toBe(false);
	expect(draws).toBe(1);
	expect(
		await drawInBatches(
			[1],
			async () => {
				draws++;
			},
			controller.signal,
		),
	).toBe(false);
	expect(draws).toBe(1);
	await expect(
		drawInBatches(
			[1],
			async () => {
				throw new Error("draw failed");
			},
			new AbortController().signal,
		),
	).rejects.toThrow("draw failed");
});

test("历史坐标按 ID 保留，新增节点有稳定坐标，空图和单节点可用", () => {
	const saved = [
		{ id: "a", x: 12.5, y: -38 },
		{ id: "removed", x: 0, y: 0 },
	];
	const nodes = [{ id: "b" }, { id: "a" }, { id: "c" }];
	const positions = fundsNodePositions(nodes, 160, saved);
	expect(positions.get("a")).toEqual({ x: 12.5, y: -38 });
	expect(positions.has("removed")).toBe(false);
	expect(positions).toEqual(fundsNodePositions(nodes, 160, saved));
	expect(positions.get("b")).toEqual({ x: 160, y: 0 });
	expect(fundsNodePositions([], 160).size).toBe(0);
	expect(fundsNodePositions([{ id: "only" }], 160).get("only")).toEqual({
		x: 0,
		y: 0,
	});
});
