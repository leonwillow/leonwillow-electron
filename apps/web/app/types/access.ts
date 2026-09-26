/**
 * Web 界面授权的本地状态、判断参数与全局指令类型。
 * 登录模块将后端返回的角色和权限投影为此状态；这里不定义认证接口 DTO。
 */
import type { ObjectDirective } from 'vue';

export interface AccessSnapshot {
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export type AccessRequirement = string | readonly string[];
export type AccessMatch = 'any' | 'all';
export type AccessDirective = ObjectDirective<HTMLElement, AccessRequirement, 'all'>;

declare module 'vue' {
  interface GlobalDirectives {
    vHasPermi: AccessDirective;
    vHasRoles: AccessDirective;
  }
}
