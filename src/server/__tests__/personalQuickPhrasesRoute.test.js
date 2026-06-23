import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GET as quickPhrasesGet,
  PUT as quickPhrasesPut
} from '../../../app/api/personal/quick-phrases/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('personal quick phrases route rejects unauthenticated and non-support users', async () => {
  const unauthenticated = await quickPhrasesGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);

  const requester = await quickPhrasesPut(buildRequest({
    userId: 'u_requester_1',
    body: { phrases: [] }
  }));
  assert.equal(requester.status, 403);

  const admin = await quickPhrasesPut(buildRequest({
    userId: 'u_admin_1',
    body: { phrases: [] }
  }));
  assert.equal(admin.status, 403);
});

test('support users can save and load their own quick phrases', async () => {
  const saveResponse = await quickPhrasesPut(buildRequest({
    userId: 'u_l1_1',
    body: {
      phrases: [
        {
          id: 'p1',
          title: 'Need screenshot',
          content: 'Please provide a screenshot and operation path.',
          keywords: ['screenshot'],
          enabled: true
        }
      ]
    }
  }));
  const savePayload = await saveResponse.json();

  assert.equal(saveResponse.status, 200);
  assert.equal(savePayload.ok, true);
  assert.equal(savePayload.config.phrases[0].title, 'Need screenshot');
  assert.equal(savePayload.config.updatedBy.id, 'u_l1_1');

  const getResponse = await quickPhrasesGet(buildRequest({ userId: 'u_l1_1' }));
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.config.phrases[0].content, 'Please provide a screenshot and operation path.');
});

test('personal quick phrase configs are isolated by current user', async () => {
  await quickPhrasesPut(buildRequest({
    userId: 'u_l1_1',
    body: {
      phrases: [{ id: 'p1', title: 'L1 phrase', content: 'L1 content' }]
    }
  }));

  const l2Response = await quickPhrasesGet(buildRequest({ userId: 'u_l2_1' }));
  const l2Payload = await l2Response.json();

  assert.equal(l2Response.status, 200);
  assert.equal(l2Payload.ok, true);
  assert.deepEqual(l2Payload.config.phrases, []);
});

test('personal quick phrases route returns structured validation errors', async () => {
  const response = await quickPhrasesPut(buildRequest({
    userId: 'u_l1_1',
    body: {
      phrases: [{ id: 'p1', title: '', content: '' }]
    }
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.reason, '常用话术配置校验失败');
  assert.deepEqual(payload.errors, [
    { path: ['phrases', 0, 'title'], message: '请输入话术标题' },
    { path: ['phrases', 0, 'content'], message: '请输入话术内容' }
  ]);
});

function buildRequest({ userId = 'u_l1_1', body = {} } = {}) {
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
