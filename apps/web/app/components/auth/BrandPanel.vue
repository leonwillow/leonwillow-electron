<!-- 登录页专用品牌展示，由 /auth/login 引用；桌面展示完整侧栏，窄屏仅保留品牌标识。 -->
<template>
  <aside class="brand-panel relative flex flex-col overflow-hidden rounded-3xl bg-elevated p-7 lg:p-12">
    <div class="relative z-10 flex items-center gap-3">
      <span class="flex size-10 items-center justify-center rounded-xl bg-inverted text-inverted">
        <UIcon name="i-lucide-layers-2" class="size-5" />
      </span>
      <div>
        <p class="text-base font-semibold tracking-tight text-highlighted">LeonWillow</p>
        <p class="mt-0.5 text-xs tracking-[0.18em] text-muted">WORK PLATFORM</p>
      </div>
    </div>

    <div class="relative z-10 my-auto hidden py-20 lg:block">
      <p class="mb-6 text-xs font-medium tracking-[0.25em] text-muted">YOUR SPACE TO FOCUS</p>
      <h2 class="text-4xl leading-[1.5] font-semibold tracking-tight xl:text-5xl">
        <span class="text-highlighted">让工作有序，</span><br>
        <span class="text-muted">让专注发生。</span>
      </h2>
      <p class="mt-6 max-w-xs text-sm leading-7 text-muted">从这里，开启今天的工作。</p>
    </div>

    <div class="relative z-10 hidden items-center gap-2 text-xs text-muted lg:flex">
      <span class="size-1.5 rounded-full bg-primary" />
      <span>一个空间，连接你的日常工作</span>
    </div>
    <div aria-hidden="true" class="brand-orbit pointer-events-none absolute -right-48 -bottom-64 hidden size-[620px] rounded-full border border-default lg:block">
      <div class="absolute inset-12 rounded-full border border-default" />
      <div class="absolute inset-24 rounded-full border border-default" />
      <div class="absolute inset-36 rounded-full border border-default" />
    </div>
  </aside>
</template>

<style scoped>
.brand-panel {
  background-image: radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--ui-primary) 9%, transparent), transparent 70%);
}

.brand-orbit {
  background: radial-gradient(circle, color-mix(in srgb, var(--ui-primary) 7%, transparent), transparent 70%);
}
</style>
