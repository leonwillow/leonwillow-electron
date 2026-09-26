/**
 * Web / Electron 渲染界面共用的授权状态入口，由 Nuxt 自动导入。
 * 登录成功或授权刷新后整体替换快照；退出、切换账号及授权失效时清空。
 * 状态只保存在当前 Nuxt 应用内存中，指令和组件读取同一份快照。
 */
import type { AccessMatch, AccessRequirement, AccessSnapshot } from '../types/access';
import { hasSnapshotPermission, hasSnapshotRole } from './access/checks';

export function useAccess() {
  const snapshot = useState<AccessSnapshot | null>('access:snapshot', () => null);

  function setAccess(value: AccessSnapshot) {
    // 一次替换角色与权限，避免观察者读取到两个账号混合的授权状态。
    snapshot.value = { roles: [...value.roles], permissions: [...value.permissions] };
  }

  function clearAccess() {
    snapshot.value = null;
  }

  function hasPermission(requirement: AccessRequirement, match: AccessMatch = 'any') {
    return hasSnapshotPermission(snapshot.value, requirement, match);
  }

  function hasRole(requirement: AccessRequirement, match: AccessMatch = 'any') {
    return hasSnapshotRole(snapshot.value, requirement, match);
  }

  return {
    ready: computed(() => snapshot.value !== null),
    snapshot: readonly(snapshot),
    setAccess,
    clearAccess,
    hasPermission,
    hasRole,
  };
}
