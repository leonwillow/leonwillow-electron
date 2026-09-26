/**
 * Nuxt SPA 启动时注册全局权限/角色指令，浏览器与 Electron 共用。
 * 在插件上下文取得授权状态，再交给指令使用，避免在 DOM 钩子中调用 Nuxt composable。
 */
import { createAccessDirective } from '../directives/access';

export default defineNuxtPlugin((nuxtApp) => {
  const { hasPermission, hasRole } = useAccess();

  nuxtApp.vueApp.directive('hasPermi', createAccessDirective(hasPermission, 'data-permission-denied'));
  nuxtApp.vueApp.directive('hasRoles', createAccessDirective(hasRole, 'data-role-denied'));
});
