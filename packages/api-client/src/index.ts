import { treaty, type Treaty } from '@elysia/eden';
import type { App } from '@platform/server/types';
import { createAlova, type StatesExport, type StatesHook } from 'alova';
import { edenAdapter } from './adapters/eden';

export type ApiOptions<SE extends StatesExport<unknown>> = {
  baseURL: string;
  statesHook: StatesHook<SE>;
};

export function createApi<SE extends StatesExport<unknown>>({ baseURL, statesHook }: ApiOptions<SE>) {
  const eden = treaty<App>(baseURL);
  const alova = createAlova({
    baseURL,
    statesHook,
    requestAdapter: edenAdapter,
    timeout: 10_000,
    cacheFor: null,
  });

  return {
    test: () => alova.Get<Treaty.Data<typeof eden.test.get>>('/test', {
      execute: (signal) => eden.test.get({ fetch: { signal } }),
    }),
  };
}
