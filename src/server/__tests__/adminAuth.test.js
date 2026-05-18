import test from 'node:test';
import assert from 'node:assert/strict';

import { requireAdminUser } from '../adminAuth.js';

test('admin guard rejects missing user and non-admin user', () => {
  assert.deepEqual(requireAdminUser(null), { ok: false, status: 401, reason: '未登录' });
  assert.deepEqual(requireAdminUser({ id: 'u_l1_1', role: 'L1' }), { ok: false, status: 403, reason: '无管理员权限' });
});

test('admin guard accepts administrator', () => {
  const user = { id: 'u_admin_1', role: 'ADMIN', name: '管理员' };

  assert.deepEqual(requireAdminUser(user), { ok: true, user });
});
