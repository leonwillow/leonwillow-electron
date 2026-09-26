/**
 * useAccess 共用的纯判断规则，供指令、v-if 和资源入口过滤间接调用。
 * 未取得授权快照或条件无效时拒绝显示；这里只决定界面可见性。
 */
import { ALL_PERMISSION } from '@platform/access-contract';
import type { AccessMatch, AccessRequirement, AccessSnapshot } from '../../types/access';

function matches(
  requirement: AccessRequirement,
  match: AccessMatch,
  isValid: (value: string) => boolean,
  isGranted: (value: string) => boolean,
): boolean {
  const values = typeof requirement === 'string' ? [requirement] : requirement;

  if (!Array.isArray(values)) return false;

  // 展开稀疏数组后逐项校验，避免空数组/空槽被 every() 跳过而错误放行。
  const required = [...values];
  if (required.length === 0
    || !required.every(value => typeof value === 'string' && isValid(value))) {
    return false;
  }

  return match === 'all' ? required.every(isGranted) : required.some(isGranted);
}

export function hasSnapshotPermission(
  snapshot: AccessSnapshot | null,
  requirement: AccessRequirement,
  match: AccessMatch = 'any',
): boolean {
  if (!snapshot) return false;

  return matches(
    requirement,
    match,
    // 业务条件只接受具体的三段式权限，不展开 system:*:query 等部分通配。
    value => /^[^:\s*]+:[^:\s*]+:[^:\s*]+$/.test(value),
    value => snapshot.permissions.includes(ALL_PERMISSION) || snapshot.permissions.includes(value),
  );
}

export function hasSnapshotRole(
  snapshot: AccessSnapshot | null,
  requirement: AccessRequirement,
  match: AccessMatch = 'any',
): boolean {
  if (!snapshot) return false;

  // 角色表示实际身份，不根据 admin 等名称推断最高授权或其他角色身份。
  return matches(requirement, match, value => value.trim().length > 0, value => snapshot.roles.includes(value));
}
