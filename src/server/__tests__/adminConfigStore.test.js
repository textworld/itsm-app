import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInsuranceType,
  getDataFixSchemeConfig,
  getScheduleConfig,
  getSupportRestConfig,
  getSystemConfig,
  listEnabledDictionaryOptions,
  listInsuranceTypes,
  listL1Users,
  listTicketClassificationDictionaryTypes,
  saveDataFixSchemeConfig,
  saveScheduleConfig,
  saveSupportRestConfig,
  saveSystemConfig,
  setInsuranceTypeEnabled,
  updateInsuranceType
} from '../adminConfigStore.js';
import { reseedDb } from '../db.js';

const adminUser = { id: 'u_admin_1', name: '管理员', role: 'ADMIN' };

test('admin config store seeds 20 default data fix schemes', () => {
  reseedDb();

  const config = getDataFixSchemeConfig();

  assert.equal(config.schemes.length, 20);
  assert.ok(config.schemes.every((scheme) => scheme.id));
  assert.ok(config.schemes.every((scheme) => scheme.title));
  assert.ok(config.schemes.every((scheme) => scheme.description));
});

test('admin config store seeds default systems from database config', () => {
  reseedDb();

  const config = getSystemConfig();

  assert.ok(config.systems.length >= 8);
  assert.ok(config.systems.some((system) => system.code === 'ERP_CORE' && system.name === 'ERP 核心系统'));
  assert.ok(config.systems.every((system) => Object.hasOwn(system, 'visibleInSubmit')));
});

test('admin config store exposes classification dictionary types and enabled options', () => {
  reseedDb();

  const dictionaryTypes = listTicketClassificationDictionaryTypes();
  const moduleOptions = listEnabledDictionaryOptions('SYSTEM_MODULE');

  assert.ok(dictionaryTypes.some((item) => item.type === 'INSURANCE_TYPE' && item.name === '险种词典'));
  assert.ok(dictionaryTypes.some((item) => item.type === 'SYSTEM_MODULE' && item.name === '模块词典'));
  assert.ok(moduleOptions.some((item) => item.id === 'module_policy' && item.name === '保单模块'));
  assert.ok(moduleOptions.every((item) => item.value === item.id && item.label === item.name));
});

test('admin config store saves systems and exposes only visible systems to selectors', () => {
  const result = saveSystemConfig(
    {
      systems: [
        {
          id: 'sys_erp',
          code: 'erp_core',
          name: 'ERP 新名称',
          category: 'OLD',
          visibleInSubmit: true,
          ticketClassification: { fieldLabel: '模块', dictionaryType: 'SYSTEM_MODULE' }
        },
        { id: 'sys_hidden', code: 'HIDDEN_SYS', name: '隐藏系统', category: 'NEW', visibleInSubmit: false }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, true);
  assert.equal(getSystemConfig().systems.length, 2);
  assert.equal(getSystemConfig().systems[0].code, 'ERP_CORE');
  assert.deepEqual(getSystemConfig().systems[0].ticketClassification, { fieldLabel: '模块', dictionaryType: 'SYSTEM_MODULE' });
  assert.equal(getSystemConfig({ visibleOnly: true }).systems.length, 1);
  assert.equal(getSystemConfig({ visibleOnly: true }).systems[0].name, 'ERP 新名称');
});

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

test('admin config store saves data fix scheme config with updater metadata', () => {
  const result = saveDataFixSchemeConfig(
    {
      schemes: [
        {
          id: 'scheme_store_test',
          title: '月结数据重算',
          description: '用于修复月结汇总数据不一致'
        }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, true);
  assert.equal(result.config.schemes.length, 1);
  assert.equal(result.config.schemes[0].title, '月结数据重算');
  assert.equal(result.config.updatedBy.id, adminUser.id);

  const saved = getDataFixSchemeConfig();
  assert.deepEqual(saved.schemes, result.config.schemes);
  assert.equal(saved.updatedBy.id, adminUser.id);
});

test('admin config store rejects invalid data fix scheme config with structured errors', () => {
  const result = saveDataFixSchemeConfig(
    {
      schemes: [{ id: 'scheme_invalid', title: '', description: '' }]
    },
    adminUser
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, '数据修正方案配置校验失败');
  assert.deepEqual(result.errors, [
    { path: ['schemes', 0, 'title'], message: '请输入方案标题' },
    { path: ['schemes', 0, 'description'], message: '请输入方案描述' }
  ]);
});
