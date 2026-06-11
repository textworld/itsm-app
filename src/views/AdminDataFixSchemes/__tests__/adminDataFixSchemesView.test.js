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

test('data fix scheme admin view is replaced by solution library view', () => {
  assert.match(source, /AdminSolutions/);
  assert.doesNotMatch(source, /\/api\/admin\/data-fix-schemes/);
  assert.doesNotMatch(source, /数据修正方案已保存/);
});

test('data fix scheme admin page redirects administrators to solution library', () => {
  assert.match(routeSource, /getLoginRedirectHref\('\/data-fix-schemes'\)/);
  assert.match(routeSource, /user\.role !== ROLES\.ADMIN/);
  assert.match(routeSource, /redirect\('\/solutions'\)/);
  assert.doesNotMatch(routeSource, /<AdminDataFixSchemesPage \/>/);
});
