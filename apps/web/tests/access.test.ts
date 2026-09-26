/**
 * 验证前端授权的业务边界，使用仓库已有 Bun 运行：bun test apps/web/tests。
 * 覆盖默认拒绝、任一/全部匹配、权限独立性及超级管理员特例，不需要后端服务。
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { ALL_PERMISSION } from '@platform/access-contract';
import { hasSnapshotPermission, hasSnapshotRole } from '../app/composables/access/checks';
import type { AccessRequirement, AccessSnapshot } from '../app/types/access';

const editor: AccessSnapshot = {
  roles: ['editor', 'reviewer'],
  permissions: ['system:user:query', 'system:user:edit'],
};
const superAdmin: AccessSnapshot = { roles: ['system-owner'], permissions: [ALL_PERMISSION] };

describe('前端资源可见性判断', () => {
  it('授权尚未加载或已清空时拒绝显示', () => {
    assert.equal(hasSnapshotPermission(null, 'system:user:query'), false);
    assert.equal(hasSnapshotRole(null, 'editor'), false);
    assert.equal(hasSnapshotPermission({ roles: [], permissions: [] }, 'system:user:query'), false);
  });

  it('权限默认命中任一项，all 要求全部命中', () => {
    assert.equal(hasSnapshotPermission(editor, 'system:user:edit'), true);
    assert.equal(hasSnapshotPermission(editor, ['system:user:add', 'system:user:edit']), true);
    assert.equal(hasSnapshotPermission(editor, ['system:user:add', 'system:user:edit'], 'all'), false);
    assert.equal(hasSnapshotPermission(editor, ['system:user:query', 'system:user:edit'], 'all'), true);
  });

  it('页面与操作权限相互独立，名称严格匹配', () => {
    const queryOnly: AccessSnapshot = { roles: [], permissions: ['system:user:query'] };
    const editOnly: AccessSnapshot = { roles: [], permissions: ['system:user:edit'] };
    assert.equal(hasSnapshotPermission(queryOnly, 'system:user:edit'), false);
    assert.equal(hasSnapshotPermission(editOnly, 'system:user:query'), false);
    assert.equal(hasSnapshotPermission(editor, 'system:user:delete'), false);
    assert.equal(hasSnapshotPermission(editor, 'system:User:edit'), false);
  });

  it('角色独立判断，支持任一或全部角色', () => {
    assert.equal(hasSnapshotRole(editor, 'editor'), true);
    assert.equal(hasSnapshotRole(editor, ['manager', 'reviewer']), true);
    assert.equal(hasSnapshotRole(editor, ['manager', 'reviewer'], 'all'), false);
    assert.equal(hasSnapshotRole(editor, ['editor', 'reviewer'], 'all'), true);
    assert.equal(hasSnapshotRole(editor, 'Editor'), false);
  });

  it('空条件和含无效值的条件始终拒绝，超级管理员也一样', () => {
    const invalid: AccessRequirement[] = ['', ' ', [], ['editor', '']];
    for (const requirement of invalid) {
      assert.equal(hasSnapshotRole(editor, requirement), false);
      assert.equal(hasSnapshotRole(editor, requirement, 'all'), false);
      assert.equal(hasSnapshotPermission(superAdmin, requirement), false);
      assert.equal(hasSnapshotPermission(superAdmin, requirement, 'all'), false);
    }
    assert.equal(hasSnapshotPermission(superAdmin, ['system:user:query', '']), false);
  });

  it('全权限只由明确的 *:*:* 授权产生，不根据角色名推断', () => {
    assert.equal(hasSnapshotPermission(superAdmin, 'system:user:delete'), true);
    assert.equal(hasSnapshotPermission(superAdmin, ['system:user:add', 'system:role:edit'], 'all'), true);
    assert.equal(hasSnapshotPermission({ roles: ['admin', 'superadmin'], permissions: [] }, 'system:user:edit'), false);
    assert.equal(hasSnapshotRole(superAdmin, 'reviewer'), false);
  });

  it('模板运行时传入错误类型或稀疏数组时拒绝显示', () => {
    const invalid: unknown[] = [undefined, null, false, 1, {}, [true], new Array(1)];
    for (const requirement of invalid) {
      // 通过 JS 调用边界模拟不受 TypeScript 约束的模板值。
      assert.equal(Reflect.apply(hasSnapshotPermission, undefined, [superAdmin, requirement, 'all']), false);
      assert.equal(Reflect.apply(hasSnapshotRole, undefined, [editor, requirement, 'all']), false);
    }
  });

  it('不展开部分通配符，也不接受非三段式的业务权限条件', () => {
    assert.equal(hasSnapshotPermission({ roles: [], permissions: ['system:*:query'] }, 'system:user:query'), false);
    for (const requirement of ['system:*:query', '*:*:*', 'system:user', 'system:user:edit:extra']) {
      assert.equal(hasSnapshotPermission(superAdmin, requirement), false);
    }
  });
});
