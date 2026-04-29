import test from 'node:test';
import assert from 'node:assert/strict';

import { findUserByCredentials, listTickets } from '../store.js';

test('认证和基础数据在 SQLite 原生绑定不可用时仍可读取', () => {
  const user = findUserByCredentials('test_user', '123456', 'REQUESTER');

  assert.equal(user?.id, 'u_requester_1');
  assert.equal(user.password, undefined);
  assert.ok(listTickets().length > 0);
});
