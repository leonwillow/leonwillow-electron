/**
 * @file 资金调查局部请求的加载与失效管理。
 * 创建时间：2026-10-06
 * 修改时间：2026-10-06
 * 版本作用：沿用 Eden，请求结果仅在当前页面有效。
 * 被调用：资金图、核对及证据面板；调用：React 和 fundsError。
 * 功能：忽略已经卸载/切换条件的旧请求，提供手动刷新。
 * 预期结果：晚到的响应不会覆盖另一案件或筛选结果。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fundsError } from "@/lib/funds";
export function useFundsResource<T>(loader: () => Promise<T>) {
	const generation = useRef(0);
	const [state, setState] = useState<{
		data: T | null;
		error: string;
		loading: boolean;
	}>({ data: null, error: "", loading: true });
	const reload = useCallback(async () => {
		const request = ++generation.current;
		setState({ data: null, error: "", loading: true });
		try {
			const data = await loader();
			if (generation.current === request)
				setState({ data, error: "", loading: false });
		} catch (error) {
			if (generation.current === request)
				setState({ data: null, error: fundsError(error), loading: false });
		}
	}, [loader]);
	useEffect(() => {
		void reload();
		return () => {
			generation.current++;
		};
	}, [reload]);
	return { ...state, reload };
}
