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

const detailRouteSource = readSource('../../../../app/(protected)/solutions/[id]/page.jsx');
const detailSource = readSource('../DetailPage.jsx');

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
  assert.match(source, /THIRD_PARTY_SCHEMES_API_URL/);
  assert.match(source, /关联第三方数据修正方案/);
  assert.match(source, /showSearch/);
  assert.match(source, /allowClear/);
  assert.match(source, /href=\{`\/solutions\/\$\{record\.id\}`\}/);
  assert.doesNotMatch(source, /openDetailDrawer/);
  assert.match(source, /openReferencesDrawer/);
  assert.match(source, /引用工单/);
  assert.match(source, /referenceSearchKeyword/);
  assert.match(source, /Pagination/);
});

test('solution library admin page is administrator-only', () => {
  assert.match(routeSource, /getLoginRedirectHref\('\/solutions'\)/);
  assert.match(routeSource, /user\.role !== ROLES\.ADMIN/);
  assert.match(routeSource, /<AdminSolutionsPage \/>/);
});

test('solution detail route is administrator-only and passes route id to client page', () => {
  assert.match(detailRouteSource, /getLoginRedirectHref\('\/solutions'\)/);
  assert.match(detailRouteSource, /user\.role !== ROLES\.ADMIN/);
  assert.match(detailRouteSource, /<AdminSolutionDetailPage solutionId=\{id\} \/>/);
});

test('solution detail page supports management actions and reference search', () => {
  assert.match(detailSource, /AdminSolutionDetailPage/);
  assert.match(detailSource, /\/api\/admin\/solutions/);
  assert.match(detailSource, /loadSolutionDetail/);
  assert.match(detailSource, /handleSubmit/);
  assert.match(detailSource, /toggleEnabled/);
  assert.match(detailSource, /removeSolution/);
  assert.match(detailSource, /修改记录/);
  assert.match(detailSource, /引用工单/);
  assert.match(detailSource, /referenceSearchKeyword/);
  assert.match(detailSource, /Pagination/);
  assert.match(detailSource, /关联第三方数据修正方案/);
});

function readSource(relativePath) {
  try {
    return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  } catch {
    return '';
  }
}
