import { createApi } from '@platform/api-client';
import VueHook from 'alova/vue';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  return {
    provide: {
      api: createApi({
        baseURL: config.public.apiBaseUrl,
        statesHook: VueHook,
      }),
    },
  };
});
