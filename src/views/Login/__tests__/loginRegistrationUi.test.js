import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const loginSource = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

const authContextSource = fs.readFileSync(
  new URL('../../../context/AuthContext.jsx', import.meta.url),
  'utf8'
);

test('login page exposes public registration for non-admin roles', () => {
  assert.match(loginSource, /注册账号/);
  assert.match(loginSource, /显示名称/);
  assert.match(loginSource, /register\(/);
  assert.match(authContextSource, /name/);
  assert.match(loginSource, /ROLE_OPTIONS\.filter/);
  assert.match(loginSource, /option\.value !== ROLES\.ADMIN/);
  assert.match(authContextSource, /\/api\/auth\/register/);
});
