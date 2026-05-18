import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInsuranceType,
  getScheduleConfig,
  getSupportRestConfig,
  listInsuranceTypes,
  listL1Users,
  saveScheduleConfig,
  saveSupportRestConfig,
  setInsuranceTypeEnabled,
  updateInsuranceType
} from '../adminConfigStore.js';

const adminUser = { id: 'u_admin_1', name: '管理员', role: 'ADMIN' };

test('admin config store lists sanitized L1 users only', () => {
  const users = listL1Users();

  assert.ok(users.length >= 3);
  assert.ok(users.every((user) => user.role === 'L1'));
  assert.ok(users.every((user) => user.password === undefined));
});

test('admin config store creates, updates and toggles insurance types', () => {
  const suffix = Date.now().toString(36);
  const created = createInsuranceType(
    { code: ` demo_${suffix} `, name: `演示险种 ${suffix}` },
    adminUser
  );

  assert.equal(created.ok, true);
  assert.equal(created.item.code, `DEMO_${suffix.toUpperCase()}`);
  assert.equal(created.item.name, `演示险种 ${suffix}`);
  assert.equal(created.item.enabled, true);
  assert.equal(created.item.updatedBy.id, adminUser.id);

  const listed = listInsuranceTypes();
  assert.ok(listed.some((item) => item.id === created.item.id));

  const updated = updateInsuranceType(
    created.item.id,
    { code: `updated_${suffix}`, name: `更新险种 ${suffix}`, enabled: true },
    adminUser
  );

  assert.equal(updated.ok, true);
  assert.equal(updated.item.code, `UPDATED_${suffix.toUpperCase()}`);
  assert.equal(updated.item.name, `更新险种 ${suffix}`);

  const disabled = setInsuranceTypeEnabled(created.item.id, false, adminUser);

  assert.equal(disabled.ok, true);
  assert.equal(disabled.item.enabled, false);
});

test('admin config store saves schedule config with updater metadata', () => {
  const insurance = createInsuranceType(
    { code: `SCHEDULE_${Date.now().toString(36)}`, name: `排班险 ${Date.now()}` },
    adminUser
  );
  assert.equal(insurance.ok, true);

  const result = saveScheduleConfig(
    {
      groups: [
        {
          id: 'grp_store_test',
          name: '存储测试组',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: ['u_l1_1'] },
          insuranceTeams: [
            {
              id: 'team_store_test',
              name: '存储测试险种组',
              userIds: ['u_l1_2'],
              insuranceTypeCodes: [insurance.item.code]
            }
          ]
        }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, true);
  assert.equal(result.config.groups.length, 1);
  assert.equal(result.config.updatedBy.id, adminUser.id);

  const saved = getScheduleConfig();
  assert.deepEqual(saved.groups, result.config.groups);
  assert.equal(saved.updatedBy.id, adminUser.id);
});

test('admin config store rejects invalid schedule config with structured errors', () => {
  const result = saveScheduleConfig(
    {
      groups: [
        {
          id: 'grp_invalid',
          name: '无基础排班',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: [] },
          insuranceTeams: []
        }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, '排班配置校验失败');
  assert.deepEqual(result.errors, [
    { path: ['groups', 0, 'baseSchedule', 'userIds'], message: '基础排班至少选择一名一线人员' }
  ]);
});

test('admin config store saves support rest config with updater metadata', () => {
  const result = saveSupportRestConfig(
    {
      restPeriods: [
        {
          id: 'rest_store_test',
          userIds: ['u_l1_1'],
          startsAt: '2026-05-18T09:00:00.000Z',
          endsAt: '2026-05-18T18:00:00.000Z',
          reason: '存储测试'
        }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, true);
  assert.equal(result.config.restPeriods.length, 1);
  assert.equal(result.config.updatedBy.id, adminUser.id);

  const saved = getSupportRestConfig();
  assert.deepEqual(saved.restPeriods, result.config.restPeriods);
  assert.equal(saved.updatedBy.id, adminUser.id);
});

test('admin config store rejects invalid support rest config with structured errors', () => {
  const result = saveSupportRestConfig(
    {
      restPeriods: [
        {
          id: 'rest_invalid',
          userIds: [],
          startsAt: '2026-05-18T18:00:00.000Z',
          endsAt: '2026-05-18T09:00:00.000Z',
          reason: ''
        }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, '休息时间配置校验失败');
  assert.deepEqual(result.errors, [
    { path: ['restPeriods', 0, 'userIds'], message: '请选择一线技术支持人员' },
    { path: ['restPeriods', 0, 'endsAt'], message: '结束时间必须晚于开始时间' }
  ]);
});
