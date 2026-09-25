<script setup lang="ts">
import { useRequest } from 'alova/client';

const { $api } = useNuxtApp();
const { data, loading, error, send } = useRequest($api.test, { immediate: false });

async function runTest() {
  // 失败信息由 useRequest 的 error 状态展示。
  await send().catch(() => undefined);
}
</script>

<template>
  <main class="mx-auto max-w-xl space-y-6 px-6 py-16">
    <h1 class="text-2xl font-semibold text-highlighted">Test</h1>
    <UButton :loading="loading" :disabled="loading" @click="runTest">
      测试连接
    </UButton>
    <div aria-live="polite">
      <p v-if="loading" class="text-muted">请求中…</p>
      <p v-else-if="error" role="alert" class="text-error">{{ error.message }}</p>
      <pre v-else-if="data" class="rounded-lg bg-elevated p-4 text-default">{{ JSON.stringify(data, null, 2) }}</pre>
      <p v-else class="text-muted">点击按钮测试连接。</p>
    </div>
  </main>
</template>
