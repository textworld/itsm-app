import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as supportAssigneesGet } from '../../../app/api/support-assignees/route.js';
import { reseedDb } from '../db.js';
import { updateUserAvailability } from '../store.js';

test.beforeEach(() => {
  reseedDb();
});

test('support assignees route only returns online support accounts', async () => {
  updateUserAvailability('u_l1_1', 'OFFLINE');
  updateUserAvailability('u_l2_1', 'OFFLINE');

  const response = await supportAssigneesGet(buildRequest());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.users.some((user) => user.id === 'u_l1_1'), false);
  assert.equal(payload.users.some((user) => user.id === 'u_l2_1'), false);
  assert.equal(payload.users.some((user) => user.id === 'u_l1_2'), true);
  assert.equal(payload.users.every((user) => user.availabilityStatus === 'ONLINE'), true);
});

test('support assignees route can filter by role', async () => {
  const response = await supportAssigneesGet(buildRequest({}, '?role=L2'));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.users.length, 23);
  assert.equal(payload.users.every((user) => user.role === 'L2'), true);
});

function buildRequest(_body = {}, search = '') {
  return {
    url: `http://localhost/api/support-assignees${search}`,
    cookies: {
      get(name) {
        if (name !== 'itsm_session_user_id') return undefined;
        return { value: 'u_admin_1' };
      }
    }
  };
}
