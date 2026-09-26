<script setup lang="ts">
// 浏览器和 Electron 的根路由统一进入登录页；replace 避免返回时重复进入入口页。
await navigateTo('/auth/login', { replace: true });
</script>

<template>
  <div />
</template>
