import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

const routeSource = fs.readFileSync(
  new URL('../../../../app/(protected)/solutions/page.jsx', import.meta.url),
  'utf8'
);

test('solution library admin view replaces data fix schemes management', () => {
  assert.match(source, /\/api\/admin\/solutions/);
  assert.match(source, /标准解决方案库/);
  assert.match(source, /方案编码/);
  assert.match(source, /方案标题/);
  assert.match(source, /方案描述/);
  assert.match(source, /详细说明/);
  assert.match(source, /新增方案/);
  assert.match(source, /编辑/);
  assert.match(source, /删除/);
  assert.match(source, /启用/);
  assert.match(source, /停用/);
});

test('solution library admin page is administrator-only', () => {
  assert.match(routeSource, /getLoginRedirectHref\('\/solutions'\)/);
  assert.match(routeSource, /user\.role !== ROLES\.ADMIN/);
  assert.match(routeSource, /<AdminSolutionsPage \/>/);
});
