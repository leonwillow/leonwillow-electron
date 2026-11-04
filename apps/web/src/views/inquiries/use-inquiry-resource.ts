/**
 * @file 笔录局部资源的加载、重试与请求代际管理。
 * 创建时间：2026-11-04；修改时间：2026-11-04。
 * 版本作用：切换案件或查询条件时立即隐藏旧结果，卸载后忽略在途响应。
 * 被调用：笔录导航和视图；调用：React、Eden 错误适配。
 * 预期结果：迟到的请求不会把另一案件的资料写回当前页面。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { inquiryError } from "@/lib/inquiries";

export function useInquiryResource<T>(loader: (() => Promise<T>) | null) {
	const currentLoader = useRef(loader);
	currentLoader.current = loader;
	const [state, setState] = useState<{
		loader: typeof loader;
		data?: T;
		error: string;
		loading: boolean;
	}>({ loader, error: "", loading: !!loader });
	const generation = useRef(0);
	const reload = useCallback(async () => {
		// 保存操作可能在筛选切换之后才完成；刷新必须使用当前查询，不能重启旧查询。
		const loader = currentLoader.current;
		const request = ++generation.current;
		if (!loader) {
			setState({ loader, error: "", loading: false });
			return;
		}
		setState((current) => ({
			loader,
			data: current.loader === loader ? current.data : undefined,
			loading: true,
			error: "",
		}));
		try {
			const data = await loader();
			if (request === generation.current)
				setState({ loader, data, error: "", loading: false });
		} catch (error) {
			if (request === generation.current)
				setState({ loader, error: inquiryError(error), loading: false });
		}
	}, []);
	useEffect(() => {
		if (currentLoader.current === loader) void reload();
		return () => {
			generation.current++;
		};
	}, [loader, reload]);
	return {
		...(state.loader === loader
			? state
			: { data: undefined, loading: !!loader, error: "" }),
		reload,
	};
}
