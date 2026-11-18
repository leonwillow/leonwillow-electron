/**
 * @file 当前用户跨案件复用的画布背景设置。
 * 创建时间：2026-10-07
 * 修改时间：2026-11-18
 * 版本作用：localStorage 保存和跨窗口同步；不请求 API。
 * 被调用：GraphCanvas；调用：useLocalStorageState、model/canvas-background。
 * 预期结果：账号隔离、刷新恢复；保存失败仍保留本次设置并提示。
 */
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import {
	type CanvasBackground,
	canvasBackgroundStorageKey,
	decodeCanvasBackground,
} from "./model/canvas-background";

export function useCanvasBackground(userId: string) {
	const {
		value: background,
		save,
		error,
	} = useLocalStorageState<CanvasBackground>({
		key: canvasBackgroundStorageKey(userId),
		decode: decodeCanvasBackground,
		encode: (value) => JSON.stringify({ version: 1, ...value }),
		saveErrorMessage: "画布背景暂未保存，刷新后可能丢失。",
	});
	return { background, save, error };
}
