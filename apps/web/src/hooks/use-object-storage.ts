import { useCallback, useEffect, useState } from "react";

// 迁移自 use-object-cookie：保留对象状态接口，适配 Web/Electron 的存储和跨窗口同步。
export function useObjectStorage<T>(
	key: string,
	fallback: T,
	decode: (value: unknown) => T,
	encode?: (value: T) => unknown,
): [T, (value: T) => void] {
	const [value, setValue] = useState<T>(fallback);
	const updateValue = useCallback(
		(next: T) => {
			setValue(next);
			try {
				localStorage.setItem(key, JSON.stringify(encode ? encode(next) : next));
			} catch {
				/* 禁用存储时当前窗口仍可设置主题。 */
			}
		},
		[key, encode],
	);

	useEffect(() => {
		const onStorage = (event: StorageEvent) => {
			if (event.key !== key && event.key !== null) return;
			try {
				setValue(decode(JSON.parse(event.newValue ?? "null")));
			} catch {
				setValue(decode(null));
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, [key, decode]);

	return [value, updateValue];
}
