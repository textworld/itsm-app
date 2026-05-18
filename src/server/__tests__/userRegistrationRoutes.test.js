import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as registerPost } from '../../../app/api/auth/register/route.js';
import {
  GET as adminUsersGet,
  PATCH as adminUsersPatch,
  POST as adminUsersPost
} from '../../../app/api/admin/users/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('public register route creates normal users and sets a session cookie', async () => {
  const suffix = Date.now().toString(36);
  const response = await registerPost(buildRequest({
    username: `route_user_${suffix}`,
    password: '123456',
    role: 'REQUESTER',
    name: `路由用户_${suffix}`
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.user.role, 'REQUESTER');
  assert.equal(payload.user.name, `路由用户_${suffix}`);
  assert.match(response.headers.get('set-cookie') || '', /itsm_session_user_id=/);
});

test('public register route rejects administrator role', async () => {
  const response = await registerPost(buildRequest({
    username: `route_admin_${Date.now().toString(36)}`,
    password: '123456',
    role: 'ADMIN',
    name: '管理员'
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.reason, '公开注册不能创建管理员账号');
});

test('admin users route requires administrator and can create admin users', async () => {
  const forbidden = await adminUsersGet(buildRequest({}, 'u_l1_1'));
  assert.equal(forbidden.status, 403);

  const suffix = Date.now().toString(36);
  const createResponse = await adminUsersPost(buildRequest({
    username: `managed_admin_${suffix}`,
    password: '123456',
    role: 'ADMIN',
    name: `管理员_${suffix}`
  }));
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.user.role, 'ADMIN');
  assert.equal(createPayload.user.name, `管理员_${suffix}`);

  const listResponse = await adminUsersGet(buildRequest());
  const listPayload = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.ok(listPayload.users.some((user) => user.username === `managed_admin_${suffix}`));
});

test('admin users route can toggle account availability', async () => {
  const response = await adminUsersPatch(buildRequest({
    userId: 'u_l1_1',
    availabilityStatus: 'OFFLINE'
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.user.id, 'u_l1_1');
  assert.equal(payload.user.availabilityStatus, 'OFFLINE');

  const listResponse = await adminUsersGet(buildRequest());
  const listPayload = await listResponse.json();
  assert.equal(listPayload.users.find((user) => user.id === 'u_l1_1').availabilityStatus, 'OFFLINE');
});

function buildRequest(body = {}, userId = 'u_admin_1') {
  return {
    cookies: {
      get(name) {
        if (name !== 'itsm_session_user_id' || !userId) return undefined;
        return { value: userId };
      }
    },
    async json() {
      return body;
    }
  };
}
