import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DEMO_LOGIN_ACCOUNTS, getDemoLoginAccountsByRole } from '../demoAccounts.js';
import { ROLES } from '../../../constants/roles.js';

const initialUsers = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src', 'mock', 'initialUsers.json'), 'utf8')
);

test('登录页一键登录账号覆盖全部初始账号', () => {
  assert.deepEqual(
    DEMO_LOGIN_ACCOUNTS.map((account) => account.username),
    initialUsers.map((user) => user.username)
  );

  for (const role of [ROLES.REQUESTER, ROLES.L1, ROLES.L2, ROLES.ADMIN]) {
    const accounts = getDemoLoginAccountsByRole(role);
    const roleUsers = initialUsers.filter((user) => user.role === role);

    assert.equal(accounts.length, roleUsers.length);
    assert.ok(accounts.every((account) => account.role === role));
    assert.ok(accounts.every((account) => account.password === '123456'));
  }
});
