import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GET as insuranceGet,
  POST as insurancePost
} from '../../../app/api/admin/dictionaries/insurance-types/route.js';
import {
  PATCH as insurancePatch
} from '../../../app/api/admin/dictionaries/insurance-types/[id]/route.js';
import {
  GET as schedulesGet,
  PUT as schedulesPut
} from '../../../app/api/admin/schedules/route.js';
import {
  GET as supportRestsGet,
  PUT as supportRestsPut
} from '../../../app/api/admin/support-rests/route.js';
import {
  GET as adminDataFixSchemesGet,
  PUT as adminDataFixSchemesPut
} from '../../../app/api/admin/data-fix-schemes/route.js';
import {
  GET as adminSystemsGet,
  PUT as adminSystemsPut
} from '../../../app/api/admin/systems/route.js';
import {
  GET as dataFixSchemesGet
} from '../../../app/api/data-fix-schemes/route.js';
import { GET as systemsGet } from '../../../app/api/systems/route.js';
import { GET as dictionaryOptionsGet } from '../../../app/api/dictionaries/options/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('admin insurance routes reject unauthenticated and non-admin users', async () => {
  const unauthenticated = await insuranceGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).reason, '未登录');

  const forbidden = await insurancePost(buildRequest({
    userId: 'u_l1_1',
    body: { code: 'ROUTE_FORBIDDEN', name: '无权限险' }
  }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).reason, '无管理员权限');
});

test('admin insurance routes create and update insurance types', async () => {
  const suffix = Date.now().toString(36);
  const createResponse = await insurancePost(buildRequest({
    body: { code: `route_${suffix}`, name: `路由险种 ${suffix}` }
  }));
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.item.code, `ROUTE_${suffix.toUpperCase()}`);

  const patchResponse = await insurancePatch(
    buildRequest({ body: { enabled: false } }),
    { params: Promise.resolve({ id: createPayload.item.id }) }
  );
  const patchPayload = await patchResponse.json();

  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.ok, true);
  assert.equal(patchPayload.item.enabled, false);
});

test('admin insurance routes return structured validation errors', async () => {
  const response = await insurancePost(buildRequest({
    body: { code: '', name: '' }
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.reason, '险种词典校验失败');
  assert.deepEqual(payload.errors, [
    { path: ['code'], message: '请输入险种编码' },
    { path: ['name'], message: '请输入险种名称' }
  ]);
});

test('admin schedule routes load options and reject invalid saves', async () => {
  const getResponse = await schedulesGet(buildRequest());
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.ok(getPayload.systems.some((item) => item.value === 'ERP_CORE'));
  assert.ok(getPayload.users.every((user) => user.role === 'L1'));
  assert.ok(getPayload.insuranceTypes.length > 0);

  const putResponse = await schedulesPut(buildRequest({
    body: {
      groups: [
        {
          id: 'grp_invalid',
          name: '无基础排班',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: [] },
          insuranceTeams: []
        }
      ]
    }
  }));
  const putPayload = await putResponse.json();

  assert.equal(putResponse.status, 400);
  assert.equal(putPayload.reason, '排班配置校验失败');
  assert.deepEqual(putPayload.errors, [
    { path: ['groups', 0, 'baseSchedule', 'userIds'], message: '基础排班至少选择一名一线人员' }
  ]);
});

test('admin support rest routes require admin users', async () => {
  const unauthenticated = await supportRestsGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).reason, '未登录');

  const forbidden = await supportRestsPut(buildRequest({
    userId: 'u_l1_1',
    body: { restPeriods: [] }
  }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).reason, '无管理员权限');
});

test('admin support rest routes load L1 users, save config and return structured validation errors', async () => {
  const getResponse = await supportRestsGet(buildRequest());
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.ok(Array.isArray(getPayload.config.restPeriods));
  assert.ok(getPayload.users.every((user) => user.role === 'L1'));
  assert.ok(Array.isArray(getPayload.upcoming.days));

  const putResponse = await supportRestsPut(buildRequest({
    body: {
      restPeriods: [
        {
          id: 'rest_route',
          userIds: ['u_l1_1'],
          startsAt: '2026-05-18T09:00:00.000Z',
          endsAt: '2026-05-18T18:00:00.000Z',
          reason: '接口测试'
        }
      ]
    }
  }));
  const putPayload = await putResponse.json();

  assert.equal(putResponse.status, 200);
  assert.equal(putPayload.ok, true);
  assert.equal(putPayload.config.restPeriods[0].reason, '接口测试');

  const invalidResponse = await supportRestsPut(buildRequest({
    body: {
      restPeriods: [
        {
          id: 'rest_invalid',
          userIds: [],
          startsAt: '2026-05-18T18:00:00.000Z',
          endsAt: '2026-05-18T09:00:00.000Z',
          reason: ''
        }
      ]
    }
  }));
  const invalidPayload = await invalidResponse.json();

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidPayload.reason, '休息时间配置校验失败');
  assert.deepEqual(invalidPayload.errors, [
    { path: ['restPeriods', 0, 'userIds'], message: '请选择一线技术支持人员' },
    { path: ['restPeriods', 0, 'endsAt'], message: '结束时间必须晚于开始时间' }
  ]);
});

test('admin data fix scheme routes require admin users', async () => {
  const unauthenticated = await adminDataFixSchemesGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).reason, '未登录');

  const forbidden = await adminDataFixSchemesPut(buildRequest({
    userId: 'u_l1_1',
    body: { schemes: [] }
  }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).reason, '无管理员权限');
});

test('data fix scheme routes save admin config and expose schemes to logged-in requesters', async () => {
  const putResponse = await adminDataFixSchemesPut(buildRequest({
    body: {
      schemes: [
        {
          id: 'scheme_route',
          title: '客户资料同步',
          description: '修复客户资料同步异常'
        }
      ]
    }
  }));
  const putPayload = await putResponse.json();

  assert.equal(putResponse.status, 200);
  assert.equal(putPayload.ok, true);
  assert.equal(putPayload.config.schemes[0].title, '客户资料同步');

  const getResponse = await adminDataFixSchemesGet(buildRequest());
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.config.schemes[0].description, '修复客户资料同步异常');

  const publicResponse = await dataFixSchemesGet(buildRequest({ userId: 'u_requester_1' }));
  const publicPayload = await publicResponse.json();

  assert.equal(publicResponse.status, 200);
  assert.equal(publicPayload.ok, true);
  assert.deepEqual(publicPayload.schemes, getPayload.config.schemes);

  const unauthenticated = await dataFixSchemesGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);
});

test('admin data fix scheme route returns structured validation errors', async () => {
  const response = await adminDataFixSchemesPut(buildRequest({
    body: { schemes: [{ id: 'scheme_invalid', title: '', description: '' }] }
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.reason, '数据修正方案配置校验失败');
  assert.deepEqual(payload.errors, [
    { path: ['schemes', 0, 'title'], message: '请输入方案标题' },
    { path: ['schemes', 0, 'description'], message: '请输入方案描述' }
  ]);
});

test('dictionary options route returns enabled options and requires a type', async () => {
  const response = await dictionaryOptionsGet(buildRequest({
    userId: 'u_requester_1',
    url: 'http://localhost/api/dictionaries/options?type=SYSTEM_MODULE'
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.dictionary.type, 'SYSTEM_MODULE');
  assert.ok(payload.options.some((item) => item.id === 'module_policy' && item.name === '保单模块'));
  assert.ok(payload.options.every((item) => item.enabled === undefined));

  const invalidResponse = await dictionaryOptionsGet(buildRequest({
    userId: 'u_requester_1',
    url: 'http://localhost/api/dictionaries/options'
  }));
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).reason, '字典类型不能为空');
});

test('admin system routes save configured systems and public route returns visible systems', async () => {
  const forbidden = await adminSystemsGet(buildRequest({ userId: 'u_l1_1' }));
  assert.equal(forbidden.status, 403);

  const putResponse = await adminSystemsPut(buildRequest({
    body: {
      systems: [
        {
          id: 'sys_erp',
          code: 'ERP_CORE',
          name: 'ERP 核心系统',
          category: 'OLD',
          visibleInSubmit: true,
          ticketClassification: { fieldLabel: '模块', dictionaryType: 'SYSTEM_MODULE' }
        },
        { id: 'sys_hidden', code: 'HIDDEN_SYS', name: '隐藏系统', category: 'NEW', visibleInSubmit: false }
      ]
    }
  }));
  const putPayload = await putResponse.json();

  assert.equal(putResponse.status, 200);
  assert.equal(putPayload.config.systems.length, 2);

  const getResponse = await adminSystemsGet(buildRequest());
  const getPayload = await getResponse.json();
  assert.ok(Array.isArray(getPayload.dictionaryTypes));

  const publicResponse = await systemsGet(buildRequest({ userId: 'u_requester_1' }));
  const publicPayload = await publicResponse.json();

  assert.equal(publicResponse.status, 200);
  assert.equal(publicPayload.systems.length, 1);
  assert.equal(publicPayload.systems[0].code, 'ERP_CORE');
  assert.deepEqual(publicPayload.systems[0].ticketClassification, {
    fieldLabel: '模块',
    dictionaryType: 'SYSTEM_MODULE',
    dictionaryName: '模块词典'
  });
});

function buildRequest({ userId = 'u_admin_1', body = {}, url = 'http://localhost/api/test' } = {}) {
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
