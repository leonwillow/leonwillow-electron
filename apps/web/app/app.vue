<script setup lang="ts">
// Web 和 Electron 共用的应用入口，为所有页面提供 Nuxt UI 上下文和中文组件文案。
import { zh_cn } from '@nuxt/ui/locale';

useHead({ htmlAttrs: { lang: 'zh-CN' } });
</script>

<template>
  <UApp :locale="zh_cn">
    <NuxtPage />
  </UApp>
</template>
