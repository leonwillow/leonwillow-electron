/**
 * 由 access 插件创建角色/权限指令，在挂载、绑定值变化和授权刷新时更新显隐。
 * 使用独立属性配合全局 CSS 隐藏元素，保留 Vue 管理的 DOM 以支持重新授权。
 */
import type { ShallowRef, WatchHandle } from 'vue';
import type { AccessDirective, AccessMatch, AccessRequirement } from '../types/access';

interface AccessRule {
  requirement: AccessRequirement;
  match: AccessMatch;
}

export function createAccessDirective(
  check: (requirement: AccessRequirement, match: AccessMatch) => boolean,
  deniedAttribute: 'data-permission-denied' | 'data-role-denied',
): AccessDirective {
  const elements = new WeakMap<HTMLElement, { rule: ShallowRef<AccessRule>; stop: WatchHandle }>();

  return {
    beforeMount(el, binding) {
      const rule = shallowRef<AccessRule>({
        requirement: binding.value,
        match: binding.modifiers.all ? 'all' : 'any',
      });
      // 在插入 DOM 前隐藏，授权变化时同步撤回；不依赖宿主组件是否重新渲染。
      const stop = watchEffect(() => {
        el.toggleAttribute(deniedAttribute, !check(rule.value.requirement, rule.value.match));
      }, { flush: 'sync' });
      elements.set(el, { rule, stop });
    },
    updated(el, binding) {
      const state = elements.get(el);
      if (state) {
        state.rule.value = {
          requirement: binding.value,
          match: binding.modifiers.all ? 'all' : 'any',
        };
      }
    },
    beforeUnmount(el) {
      // 列表、v-if 和页面切换会销毁元素，及时停止对应监听。
      elements.get(el)?.stop();
      elements.delete(el);
    },
  };
}
