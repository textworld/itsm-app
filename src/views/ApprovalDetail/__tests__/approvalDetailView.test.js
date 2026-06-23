import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

const routeSource = fs.readFileSync(
  new URL('../../../../app/(protected)/approvals/[oaId]/page.jsx', import.meta.url),
  'utf8'
);

test('审批详情页按 OA 编号从可见工单中查找并只读展示审批信息', () => {
  assert.match(source, /useParams/);
  assert.match(source, /tickets\.find\(\(item\) => item\.oaApplication\?\.oaId === oaId\)/);
  assert.match(source, /OA 审批详情/);
  assert.match(source, /审批记录/);
  assert.match(source, /工单编号/);
  assert.match(source, /审批状态/);
  assert.doesNotMatch(source, /dispatchEvent/);
  assert.doesNotMatch(source, /postOaAction/);
});

test('审批详情路由对所有登录用户开放', () => {
  assert.match(routeSource, /getProtectedRouteRedirect/);
  assert.match(routeSource, /\/approvals\/\$\{oaId\}/);
  assert.match(routeSource, /<ApprovalDetailPage \/>/);
  assert.doesNotMatch(routeSource, /ROLES\.ADMIN/);
  assert.doesNotMatch(routeSource, /requireAdminUser/);
});
