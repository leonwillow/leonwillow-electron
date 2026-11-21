/**
 * @file 通用异步资源的请求代际管理、按需暂停与手动重试 Hook。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-21
 * 版本作用：收敛资金、笔录与工作台二级目录中的重复异步加载状态机。
 * 被调用：apps/web/src/components/layout/*、apps/web/src/views/{funds,inquiries}/*。
 * 调用：react、@/lib/api。
 * 功能：支持 null 暂停加载、切换 loader 立即隐藏过期结果、同查询刷新可选保留旧数据，以及卸载后丢弃迟到响应。
 * 预期结果：迟到请求绝不污染新案件或新筛选条件的数据视图。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/api";

export type UseAsyncResourceOptions = {
	fallbackError?: string;
	keepPreviousOnReload?: boolean;
};

export function useAsyncResource<T>(
	loader: (() => Promise<T>) | null,
	options?: UseAsyncResourceOptions,
) {
	const fallbackError = options?.fallbackError ?? "暂时无法连接服务，请重试。";
	const keepPrevious = options?.keepPreviousOnReload ?? false;
	const currentLoader = useRef(loader);
	currentLoader.current = loader;
	const fallbackRef = useRef(fallbackError);
	fallbackRef.current = fallbackError;
	const keepPreviousRef = useRef(keepPrevious);
	keepPreviousRef.current = keepPrevious;

	const [state, setState] = useState<{
		loader: typeof loader;
		data: T | null;
		error: string;
		loading: boolean;
	}>({ loader, data: null, error: "", loading: !!loader });
	const generation = useRef(0);

	const reload = useCallback(async () => {
		const activeLoader = currentLoader.current;
		const request = ++generation.current;
		if (!activeLoader) {
			setState({ loader: activeLoader, data: null, error: "", loading: false });
			return;
		}
		setState((current) => ({
			loader: activeLoader,
			data:
				keepPreviousRef.current && current.loader === activeLoader
					? current.data
					: null,
			loading: true,
			error: "",
		}));
		try {
			const data = await activeLoader();
			if (request === generation.current) {
				setState({ loader: activeLoader, data, error: "", loading: false });
			}
		} catch (error) {
			if (request === generation.current) {
				setState((current) => ({
					loader: activeLoader,
					data:
						keepPreviousRef.current && current.loader === activeLoader
							? current.data
							: null,
					error: apiErrorMessage(error, fallbackRef.current),
					loading: false,
				}));
			}
		}
	}, []);

	useEffect(() => {
		if (currentLoader.current === loader) void reload();
		return () => {
			generation.current += 1;
		};
	}, [loader, reload]);

	return {
		...(state.loader === loader
			? { data: state.data, loading: state.loading, error: state.error }
			: { data: null, loading: !!loader, error: "" }),
		reload,
	};
}
