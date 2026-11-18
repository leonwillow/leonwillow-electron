/**
 * @file 跨窗口同步与存储受限回退的通用 localStorage 状态 Hook。
 * 创建时间：2026-11-18
 * 修改时间：2026-11-18
 * 版本作用：统一用户/案件隔离偏好的读取解码、动态 key 切换、storage 事件同步与写入异常提示。
 * 被调用：工作台二级菜单宽度及资金图工具栏/速览/背景/标记偏好 Hook。
 * 调用：React、浏览器 localStorage 与 storage 事件。
 * 功能：按 key 惰性读取并解码本地偏好，key 切换立即重读，写入失败保留会话状态并反馈中文提示。
 * 预期结果：消除重复存储监听样板，跨窗口同步一致且损坏数据安全回退。
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorageState<T>({
	key,
	decode,
	encode,
	saveErrorMessage = "",
}: {
	key: string;
	decode: (raw: string | null) => T;
	encode: (value: T) => string;
	saveErrorMessage?: string;
}) {
	const decodeRef = useRef(decode);
	decodeRef.current = decode;
	const encodeRef = useRef(encode);
	encodeRef.current = encode;

	const read = useCallback((targetKey: string): T => {
		try {
			return decodeRef.current(localStorage.getItem(targetKey));
		} catch {
			return decodeRef.current(null);
		}
	}, []);

	const [stored, setStored] = useState(() => ({ key, value: read(key) }));
	const [error, setError] = useState("");

	if (stored.key !== key) {
		setStored({ key, value: read(key) });
		if (error) setError("");
	}

	useEffect(() => {
		const sync = (event: StorageEvent) => {
			if (
				(!event.storageArea || event.storageArea === localStorage) &&
				(event.key === key || event.key === null)
			) {
				setStored({
					key,
					value:
						event.key === null ? read(key) : decodeRef.current(event.newValue),
				});
				setError("");
			}
		};
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [key, read]);

	const save = useCallback(
		(next: T) => {
			setStored({ key, value: next });
			try {
				localStorage.setItem(key, encodeRef.current(next));
				setError("");
			} catch {
				if (saveErrorMessage) setError(saveErrorMessage);
			}
		},
		[key, saveErrorMessage],
	);

	return { value: stored.value, save, error };
}
