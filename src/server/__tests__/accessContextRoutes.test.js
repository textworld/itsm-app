import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as sessionGet } from '../../../app/api/access/session/route.js';
import { POST as loginPost } from '../../../app/api/access/login/route.js';
import { POST as logoutPost } from '../../../app/api/access/logout/route.js';
import { POST as registerPost } from '../../../app/api/access/register/route.js';
import {
  GET as adminUsersGet,
  PATCH as adminUsersPatch,
  POST as adminUsersPost
} from '../../../app/api/access/admin/users/route.js';
import { GET as templateGet } from '../../../app/api/access/templates/permission-request/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('access session route returns current user from session cookie', async () => {
  const response = await sessionGet(buildRequest({}, 'u_requester_1'));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.user.id, 'u_requester_1');
});

test('access login and logout routes manage session cookies', async () => {
  const loginResponse = await loginPost(buildRequest({
    username: 'test_user',
    password: '123456',
    role: 'REQUESTER'
  }, null));
  const loginPayload = await loginResponse.json();

  assert.equal(loginResponse.status, 200);
  assert.equal(loginPayload.ok, true);
  assert.match(loginResponse.headers.get('set-cookie') || '', /itsm_session_user_id=/);

  const logoutResponse = await logoutPost();
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get('set-cookie') || '', /Max-Age=0/);
});

test('access register route creates public non-admin users', async () => {
  const suffix = Date.now().toString(36);
  const response = await registerPost(buildRequest({
    username: `access_user_${suffix}`,
    password: '123456',
    role: 'REQUESTER',
    name: `access user ${suffix}`
  }, null));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.user.role, 'REQUESTER');
});

test('access admin users route requires admin and can manage accounts', async () => {
  const forbidden = await adminUsersGet(buildRequest({}, 'u_l1_1'));
  assert.equal(forbidden.status, 403);

  const suffix = Date.now().toString(36);
  const createResponse = await adminUsersPost(buildRequest({
    username: `access_admin_${suffix}`,
    password: '123456',
    role: 'ADMIN',
    name: `access admin ${suffix}`
  }));
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.user.role, 'ADMIN');

  const patchResponse = await adminUsersPatch(buildRequest({
    userId: 'u_l1_1',
    availabilityStatus: 'OFFLINE'
  }));
  const patchPayload = await patchResponse.json();
  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.user.availabilityStatus, 'OFFLINE');
});

test('access permission template route returns downloadable Excel content', async () => {
  const response = await templateGet();
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.ms-excel; charset=utf-8');
  assert.match(body, /权限范围|鏉冮檺鑼冨洿/);
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
