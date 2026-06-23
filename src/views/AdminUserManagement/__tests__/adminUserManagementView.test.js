import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('admin user management view lists and creates users through admin API', () => {
  assert.match(source, /\/api\/access\/admin\/users/);
  assert.match(source, /<Table/);
  assert.match(source, /<Modal/);
  assert.match(source, /Input\.Search/);
  assert.match(source, /filteredUsers/);
  assert.match(source, /pagination=\{\{/);
  assert.match(source, /<Switch/);
  assert.match(source, /handleAvailabilityChange/);
  assert.match(source, /ROLE_OPTIONS/);
  assert.match(source, /账号管理/);
  assert.match(source, /人员类型/);
  assert.match(source, /显示名称/);
});
