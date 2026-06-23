import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createUserAccount,
  findUserByCredentials,
  listUsers,
  updateUserAvailability
} from '../store.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('public registration creates a non-admin user that can log in', () => {
  const suffix = Date.now().toString(36);
  const username = `registered_${suffix}`;

  const result = createUserAccount({
    username,
    password: '123456',
    role: 'REQUESTER',
    name: `显示名称_${suffix}`
  });

  assert.equal(result.ok, true);
  assert.equal(result.user.username, username);
  assert.equal(result.user.name, `显示名称_${suffix}`);
  assert.equal(result.user.role, 'REQUESTER');
  assert.equal(result.user.password, undefined);

  const loginUser = findUserByCredentials(username, '123456', 'REQUESTER');
  assert.equal(loginUser.id, result.user.id);
});

test('registration falls back to username when display name is omitted', () => {
  const suffix = Date.now().toString(36);
  const username = `fallback_${suffix}`;

  const result = createUserAccount({
    username,
    password: '123456',
    role: 'REQUESTER'
  });

  assert.equal(result.ok, true);
  assert.equal(result.user.name, username);
});

test('public registration rejects administrator role', () => {
  const result = createUserAccount({
    username: `public_admin_${Date.now().toString(36)}`,
    password: '123456',
    role: 'ADMIN',
    name: '管理员'
  });

  assert.deepEqual(result, {
    ok: false,
    reason: '公开注册不能创建管理员账号'
  });
});

test('registration rejects duplicate usernames and short passwords', () => {
  const duplicate = createUserAccount({
    username: 'test_user',
    password: '123456',
    role: 'REQUESTER',
    name: '测试用户'
  });
  const shortPassword = createUserAccount({
    username: `short_${Date.now().toString(36)}`,
    password: '12345',
    role: 'REQUESTER',
    name: '测试用户'
  });

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, '账号已存在');
  assert.equal(shortPassword.ok, false);
  assert.equal(shortPassword.reason, '密码至少 6 位');
});

test('administrator can create administrator accounts without switching current identity', () => {
  const suffix = Date.now().toString(36);
  const username = `admin_created_${suffix}`;

  const result = createUserAccount(
    {
      username,
      password: '123456',
      role: 'ADMIN',
      name: `管理员_${suffix}`
    },
    { allowAdmin: true }
  );

  assert.equal(result.ok, true);
  assert.equal(result.user.role, 'ADMIN');
  assert.ok(listUsers().some((user) => user.username === username && user.role === 'ADMIN'));
});

test('users are online by default and can be marked offline without blocking login', () => {
  assert.equal(listUsers().find((user) => user.id === 'u_l1_1').availabilityStatus, 'ONLINE');

  const result = updateUserAvailability('u_l1_1', 'OFFLINE');
  assert.equal(result.ok, true);
  assert.equal(result.user.availabilityStatus, 'OFFLINE');
  assert.equal(listUsers().find((user) => user.id === 'u_l1_1').availabilityStatus, 'OFFLINE');

  const loginUser = findUserByCredentials('support1', '123456', 'L1');
  assert.equal(loginUser.id, 'u_l1_1');
  assert.equal(loginUser.availabilityStatus, 'OFFLINE');
});
