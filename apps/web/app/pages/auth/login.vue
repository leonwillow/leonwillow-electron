<script setup lang="ts">
// 用户名密码登录页：由首页或 /auth/login 进入，复用 Nuxt UI 校验、密码显隐和提交状态。
// 当前调用本地 mock 供界面预览，成功后展示反馈；真实会话和登录后路由留待后端接入。
import type { AuthFormField, FormError, FormSubmitEvent } from '@nuxt/ui';
import { mockLogin, type LoginCredentials } from '~/utils/auth/mockLogin';

useHead({ title: '登录 · LeonWillow 工作平台' });

const feedback = shallowRef<{ success: boolean; message: string }>();
const pending = shallowRef(false);
const fields: AuthFormField[] = [
  {
    name: 'username',
    type: 'text',
    label: '用户名',
    placeholder: '请输入用户名（至少 5 位）',
    defaultValue: '',
    autocomplete: 'username',
    required: true,
    size: 'xl',
    icon: 'i-lucide-user-round',
    ui: { base: 'h-12 rounded-xl' },
  },
  {
    name: 'password',
    type: 'password',
    label: '密码',
    placeholder: '请输入密码（至少 5 位）',
    defaultValue: '',
    autocomplete: 'current-password',
    required: true,
    size: 'xl',
    icon: 'i-lucide-lock-keyhole',
    ui: { base: 'h-12 rounded-xl' },
  },
];

function validate(state: Partial<LoginCredentials>): FormError[] {
  const errors: FormError[] = [];
  const username = state.username?.trim() ?? '';
  if (!username) errors.push({ name: 'username', message: '请输入用户名' });
  else if (username.length < 5) errors.push({ name: 'username', message: '用户名至少需要 5 位' });
  // 密码按原始输入校验，不裁剪可能属于密码本身的空格。
  if (!state.password) errors.push({ name: 'password', message: '请输入密码' });
  else if (state.password.length < 5) errors.push({ name: 'password', message: '密码至少需要 5 位' });
  return errors;
}

async function onSubmit(event: FormSubmitEvent<LoginCredentials>) {
  if (pending.value) return;
  pending.value = true;
  feedback.value = undefined;
  try {
    await mockLogin({ username: event.data.username.trim(), password: event.data.password });
    feedback.value = { success: true, message: '欢迎回来，管理员。模拟登录已完成。' };
  } catch (error) {
    feedback.value = { success: false, message: error instanceof Error ? error.message : '登录失败，请重试' };
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <main class="grid min-h-dvh grid-rows-[auto_1fr] bg-default p-4 lg:grid-cols-2 lg:grid-rows-1 lg:gap-8 lg:p-6">
    <AuthBrandPanel />

    <section aria-labelledby="login-title" class="flex min-w-0 flex-col px-5 py-10 sm:px-12 lg:py-8">
      <div class="my-auto w-full max-w-sm self-center py-10 lg:py-16">
        <p class="mb-4 text-xs font-medium tracking-[0.22em] text-muted">WELCOME BACK</p>
        <h1 id="login-title" class="text-3xl font-semibold tracking-tight text-highlighted">欢迎回来</h1>
        <p class="mt-3 text-sm leading-6 text-muted">登录你的账号，进入工作平台。</p>

        <UAuthForm
          novalidate
          :fields="fields"
          :validate="validate"
          :loading="pending"
          :disabled="pending"
          :submit="{ label: pending ? '正在登录…' : '登录', trailingIcon: 'i-lucide-arrow-right', color: 'neutral', size: 'xl', class: 'mt-2 h-12 rounded-xl' }"
          :ui="{ form: 'space-y-6' }"
          class="mt-9"
          @input="feedback = undefined"
          @submit="onSubmit"
        >
          <template #validation>
            <UAlert
              v-if="feedback"
              :role="feedback.success ? 'status' : 'alert'"
              :color="feedback.success ? 'success' : 'error'"
              variant="soft"
              :icon="feedback.success ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
              :title="feedback.success ? '登录成功' : '登录失败'"
              :description="feedback.message"
            />
          </template>
        </UAuthForm>
      </div>

      <p class="text-center text-xs text-muted">LeonWillow 工作平台</p>
    </section>
  </main>
</template>
