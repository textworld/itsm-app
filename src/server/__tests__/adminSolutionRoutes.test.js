import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as solutionDetailGet } from '../../../app/api/admin/solutions/[id]/route.js';
import { GET as solutionReferencesGet } from '../../../app/api/admin/solutions/[id]/references/route.js';
import { GET as thirdPartyDataFixSchemesGet } from '../../../app/api/admin/third-party-data-fix-schemes/route.js';
import { createSolution, referenceSolution } from '../solutionLibraryStore.js';
import { reseedDb } from '../db.js';
import { listTickets } from '../store.js';

const admin = { id: 'u_admin_1', name: '系统管理员', role: 'ADMIN' };
const l1 = { id: 'u_l1_1', name: '一线工程师', role: 'L1' };

test.beforeEach(() => {
  reseedDb();
});

test('admin solution detail route returns solution versions and third-party association', async () => {
  const created = createSolution(buildSolutionInput(), admin).solution;

  const response = await solutionDetailGet(
    buildRequest(),
    { params: Promise.resolve({ id: created.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.solution.id, created.id);
  assert.equal(payload.solution.thirdPartyDataFixScheme.code, 'TP-DFS-001');
  assert.equal(payload.versions[0].snapshot.thirdPartyDataFixScheme.code, 'TP-DFS-001');
});

test('admin solution references route returns searchable paginated ticket references', async () => {
  const created = createSolution(buildSolutionInput(), admin).solution;
  const ticket = listTickets()[0];
  referenceSolution({ solutionId: created.id, ticketId: ticket.id }, l1);

  const response = await solutionReferencesGet(
    buildRequest({
      url: `http://localhost/api/admin/solutions/${created.id}/references?keyword=${encodeURIComponent(ticket.title.slice(0, 6))}&page=1&pageSize=5`
    }),
    { params: Promise.resolve({ id: created.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pagination.total, 1);
  assert.equal(payload.references[0].ticket.id, ticket.id);
  assert.equal(payload.references[0].versionNo, 1);
});

test('third-party data-fix scheme route searches preset schemes for admin users', async () => {
  const response = await thirdPartyDataFixSchemesGet(buildRequest({
    url: 'http://localhost/api/admin/third-party-data-fix-schemes?keyword=保单'
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.schemes.length > 0, true);
  assert.equal(payload.schemes.every((scheme) => scheme.code && scheme.title), true);
});

function buildSolutionInput() {
  return {
    code: 'SOL-ROUTE-001',
    title: '路由保单修正方案',
    description: '处理保单状态异常',
    detailHtml: '<p>核对保单状态后刷新缓存</p>',
    thirdPartyDataFixScheme: {
      id: 'tp_dfs_policy_refresh',
      code: 'TP-DFS-001',
      title: '第三方保单缓存刷新',
      sourceSystem: '第三方数据平台',
      description: '同步保单状态并刷新缓存'
    },
    ticketTypes: ['DATA_FIX'],
    referencePermission: 'COMPANY'
  };
}

function buildRequest({ userId = 'u_admin_1', body = {}, url = 'http://localhost/api/admin/solutions/test' } = {}) {
  return {
    url,
    json: async () => body,
    cookies: {
      get: (name) => {
        if (name !== 'itsm_session_user_id' || !userId) return undefined;
        return { value: userId };
      }
    }
  };
}
