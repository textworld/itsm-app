import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const initialUsers = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src', 'mock', 'initialUsers.json'), 'utf8')
);

test('初始账号中每个角色都有 3 个可登录账号', () => {
  const roles = ['REQUESTER', 'L1', 'L2'];
  const usernames = new Set(initialUsers.map((user) => user.username));

  assert.equal(usernames.size, initialUsers.length);

  for (const role of roles) {
    const roleUsers = initialUsers.filter((user) => user.role === role);

    assert.equal(roleUsers.length, 3);
    assert.ok(roleUsers.every((user) => user.password === '123456'));
  }
});

test('initial users include one administrator account', () => {
  const admins = initialUsers.filter((user) => user.role === 'ADMIN');

  assert.equal(admins.length, 1);
  assert.equal(admins[0].username, 'admin');
  assert.equal(admins[0].password, '123456');
});
