import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionCookieOptions,
  buildClearedSessionCookieOptions
} from '../session.js';

test('登录 session 使用长期持久化 cookie', () => {
  const now = new Date('2026-04-24T00:00:00.000Z');
  const cookie = buildSessionCookieOptions('u_requester_1', now);

  assert.equal(cookie.name, 'itsm_session_user_id');
  assert.equal(cookie.value, 'u_requester_1');
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'lax');
  assert.equal(cookie.path, '/');
  assert.ok(cookie.maxAge >= 60 * 60 * 24 * 365 * 20);
  assert.equal(cookie.expires?.toISOString(), '2046-04-24T00:00:00.000Z');
});

test('退出登录会清空 session cookie', () => {
  const cookie = buildClearedSessionCookieOptions();

  assert.equal(cookie.name, 'itsm_session_user_id');
  assert.equal(cookie.value, '');
  assert.equal(cookie.maxAge, 0);
  assert.equal(cookie.path, '/');
});
