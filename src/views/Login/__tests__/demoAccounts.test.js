import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_LOGIN_ACCOUNTS, getDemoLoginAccountsByRole } from '../demoAccounts.js';
import { ROLES } from '../../../constants/roles.js';

test('登录页一键登录账号覆盖每个角色的 3 个初始账号', () => {
  assert.deepEqual(
    DEMO_LOGIN_ACCOUNTS.map((account) => account.username),
    ['test_user', 'test_user2', 'test_user3', 'support1', 'support2', 'support3', 'ops1', 'ops2', 'ops3', 'admin']
  );

  for (const role of [ROLES.REQUESTER, ROLES.L1, ROLES.L2]) {
    const accounts = getDemoLoginAccountsByRole(role);

    assert.equal(accounts.length, 3);
    assert.ok(accounts.every((account) => account.role === role));
    assert.ok(accounts.every((account) => account.password === '123456'));
  }

  const adminAccounts = getDemoLoginAccountsByRole(ROLES.ADMIN);
  assert.equal(adminAccounts.length, 1);
  assert.equal(adminAccounts[0].username, 'admin');
  assert.equal(adminAccounts[0].password, '123456');
});
