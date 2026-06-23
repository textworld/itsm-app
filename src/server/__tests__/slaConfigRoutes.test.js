import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as slaRulesGet, PUT as slaRulesPut } from '../../../app/api/admin/sla-rules/route.js';
import { getSlaConfig, saveSlaConfig } from '../adminConfigStore.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('admin SLA route rejects unauthenticated and non-admin users', async () => {
  const unauthenticated = await slaRulesGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).reason, '未登录');

  const forbidden = await slaRulesPut(buildRequest({
    userId: 'u_l1_1',
    body: { rules: {} }
  }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).reason, '无管理员权限');
});

test('admin SLA route returns default config and persists valid changes', async () => {
  const getResponse = await slaRulesGet(buildRequest());
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.config.rules.DATA_EXTRACT.P0.enabled, true);
  assert.ok(Array.isArray(getPayload.channels));
  assert.ok(Array.isArray(getPayload.priorities));

  const putResponse = await slaRulesPut(buildRequest({
    body: {
      rules: {
        DATA_EXTRACT: {
          P0: {
            enabled: false,
            responseMinutes: 15,
            firstHandleMinutes: 30,
            resolveMinutes: 60,
            warnings: [
              {
                node: 'response',
                beforeMinutes: 10,
                targets: ['ASSIGNEE'],
                channels: ['DINGTALK'],
                frequencyMinutes: 5
              }
            ],
            escalations: [
              {
                afterMinutes: 60,
                target: 'GROUP_LEADER',
                useOrgHierarchy: true
              }
            ]
          }
        }
      }
    }
  }));
  const putPayload = await putResponse.json();

  assert.equal(putResponse.status, 200);
  assert.equal(putPayload.ok, true);
  assert.equal(putPayload.config.rules.DATA_EXTRACT.P0.enabled, false);
  assert.equal(putPayload.config.updatedBy.id, 'u_admin_1');
  assert.equal(getSlaConfig().rules.DATA_EXTRACT.P0.resolveMinutes, 60);
});

test('admin SLA route returns structured validation errors', async () => {
  const response = await slaRulesPut(buildRequest({
    body: {
      rules: {
        DATA_FIX: {
          P1: {
            responseMinutes: 0,
            firstHandleMinutes: 0,
            resolveMinutes: 0
          }
        }
      }
    }
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.reason, 'SLA 配置校验失败');
  assert.ok(payload.errors.some((item) => item.message === '响应时效必须大于 0'));
});

test('saveSlaConfig stores updated metadata', () => {
  const result = saveSlaConfig({
    rules: {
      CONSULT: {
        P3: {
          enabled: true,
          responseMinutes: 120,
          firstHandleMinutes: 240,
          resolveMinutes: 480
        }
      }
    }
  }, { id: 'u_admin_1', name: '系统管理员' });

  assert.equal(result.ok, true);
  assert.equal(result.config.rules.CONSULT.P3.resolveMinutes, 480);
  assert.equal(result.config.updatedBy.name, '系统管理员');
});

function buildRequest({ userId = 'u_admin_1', body = {}, url = 'http://localhost/api/admin/sla-rules' } = {}) {
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
