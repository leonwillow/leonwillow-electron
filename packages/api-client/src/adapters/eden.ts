import type { AlovaRequestAdapter } from 'alova';

type EdenResult = {
  data: unknown;
  error: unknown;
  response: Response;
  status: number;
};

type EdenRequestConfig = {
  execute: (signal: AbortSignal) => Promise<EdenResult>;
};

export const edenAdapter: AlovaRequestAdapter<EdenRequestConfig, unknown, Headers> = (
  _request,
  method,
) => {
  const controller = new AbortController();
  const timeout = method.config.timeout ?? 0;
  const signal = timeout > 0
    ? AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)])
    : controller.signal;
  // Alova 真正发送请求时才调用 Eden；创建 Method 不产生网络请求。
  const result = method.config.execute(signal);

  return {
    response: async () => {
      const response = await result;
      if (response.error) throw new Error(`请求失败（HTTP ${response.status}）`);
      return response.data;
    },
    headers: async () => (await result).response.headers,
    abort: () => controller.abort(),
  };
};
