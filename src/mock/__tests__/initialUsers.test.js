import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const initialUsers = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src', 'mock', 'initialUsers.json'), 'utf8')
);

test('初始账号中提单人保留 3 个，一线和二线各新增 20 个可登录账号', () => {
  const expectedCounts = {
    REQUESTER: 3,
    L1: 23,
    L2: 23
  };
  const usernames = new Set(initialUsers.map((user) => user.username));

  assert.equal(usernames.size, initialUsers.length);

  for (const [role, expectedCount] of Object.entries(expectedCounts)) {
    const roleUsers = initialUsers.filter((user) => user.role === role);

    assert.equal(roleUsers.length, expectedCount);
    assert.ok(roleUsers.every((user) => user.password === '123456'));
  }
});

test('一线和二线初始账号的姓名尾号与账号编号一致', () => {
  const supportRules = [
    { role: 'L1', usernamePrefix: 'support', nameKeyword: '一线' },
    { role: 'L2', usernamePrefix: 'ops', nameKeyword: '二线' }
  ];

  for (const rule of supportRules) {
    const roleUsers = initialUsers.filter((user) => user.role === rule.role);
    const orderedNumbers = roleUsers.map((user) => {
      const usernameMatch = user.username.match(new RegExp(`^${rule.usernamePrefix}(\\d+)$`));
      const nameMatch = user.name.match(/(\d+)$/);

      assert.ok(usernameMatch, `${user.username} should start with ${rule.usernamePrefix}`);
      assert.ok(user.name.includes(rule.nameKeyword), `${user.name} should include ${rule.nameKeyword}`);
      assert.ok(nameMatch, `${user.name} should end with a number`);
      assert.equal(nameMatch[1], usernameMatch[1]);

      return Number(usernameMatch[1]);
    });

    assert.deepEqual(
      orderedNumbers,
      Array.from({ length: 23 }, (_, index) => index + 1)
    );
  }
});

test('initial users include one administrator account', () => {
  const admins = initialUsers.filter((user) => user.role === 'ADMIN');

  assert.equal(admins.length, 1);
  assert.equal(admins[0].username, 'admin');
  assert.equal(admins[0].password, '123456');
});
