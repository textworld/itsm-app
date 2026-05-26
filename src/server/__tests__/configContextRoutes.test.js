import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as systemsGet } from '../../../app/api/config/systems/route.js';
import { GET as dictionaryOptionsGet } from '../../../app/api/config/dictionaries/options/route.js';
import { GET as supportAssigneesGet } from '../../../app/api/config/support-assignees/route.js';
import {
  GET as quickPhrasesGet,
  PUT as quickPhrasesPut
} from '../../../app/api/config/personal/quick-phrases/route.js';
import {
  GET as adminSystemsGet,
  PUT as adminSystemsPut
} from '../../../app/api/config/admin/systems/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('config systems route returns visible submission systems for logged-in users', async () => {
  const response = await systemsGet(buildRequest());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(payload.systems.some((system) => system.code === 'ERP_CORE'));
});

test('config dictionary options route returns enabled options by type', async () => {
  const response = await dictionaryOptionsGet(
    buildRequest({ url: 'http://localhost/api/config/dictionaries/options?type=SYSTEM_MODULE' })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.dictionary.type, 'SYSTEM_MODULE');
  assert.ok(Array.isArray(payload.options));
});

test('config support assignees route returns online support users', async () => {
  const response = await supportAssigneesGet(
    buildRequest({ url: 'http://localhost/api/config/support-assignees?role=L2' })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(payload.users.every((user) => user.role === 'L2'));
});

test('config personal quick phrases route keeps per-user support configuration', async () => {
  const saveResponse = await quickPhrasesPut(buildRequest({
    userId: 'u_l1_1',
    body: {
      phrases: [{ id: 'p1', title: 'Need screenshot', content: 'Please provide a screenshot.' }]
    }
  }));
  assert.equal(saveResponse.status, 200);

  const getResponse = await quickPhrasesGet(buildRequest({ userId: 'u_l1_1' }));
  const payload = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(payload.config.phrases[0].title, 'Need screenshot');
});

test('config admin systems route requires admin and can save system config', async () => {
  const forbidden = await adminSystemsGet(buildRequest({ userId: 'u_l1_1' }));
  assert.equal(forbidden.status, 403);

  const saveResponse = await adminSystemsPut(buildRequest({
    userId: 'u_admin_1',
    body: {
      systems: [
        { id: 'sys_erp_core', code: 'ERP_CORE', name: 'ERP Core', category: 'OLD', visibleInSubmit: true }
      ]
    }
  }));
  const payload = await saveResponse.json();

  assert.equal(saveResponse.status, 200);
  assert.equal(payload.ok, true);
});

function buildRequest({ userId = 'u_admin_1', body = {}, url = 'http://localhost/api/config/test' } = {}) {
  return {
    url,
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
