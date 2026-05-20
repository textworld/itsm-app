import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

const routeSource = fs.readFileSync(
  new URL('../../../../app/(protected)/data-fix-schemes/page.jsx', import.meta.url),
  'utf8'
);

test('data fix scheme admin view manages schemes through admin API', () => {
  assert.match(source, /\/api\/admin\/data-fix-schemes/);
  assert.match(source, /数据修正方案/);
  assert.match(source, /方案标题/);
  assert.match(source, /方案描述/);
  assert.match(source, /method: 'PUT'/);
  assert.match(source, /openCreateModal/);
  assert.match(source, /openEditModal/);
  assert.match(source, /removeScheme/);
  assert.match(source, /Table/);
  assert.match(source, /Modal/);
});

test('data fix scheme admin page is administrator-only', () => {
  assert.match(routeSource, /getLoginRedirectHref\('\/data-fix-schemes'\)/);
  assert.match(routeSource, /user\.role !== ROLES\.ADMIN/);
  assert.match(routeSource, /<AdminDataFixSchemesPage \/>/);
});
