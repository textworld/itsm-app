import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';

import {
  INSURANCE_DICTIONARY_TYPE,
  SUPPORT_REST_CONFIG_KEY,
  buildUpcomingSupportRestDays,
  validateInsuranceTypeInput,
  validateScheduleConfig,
  validateSupportRestConfig
} from '../adminConfigValidation.js';

const scheduleContext = {
  systems: [
    { value: 'ERP_CORE', label: 'ERP 核心系统' },
    { value: 'CRM_CENTER', label: 'CRM 客户管理系统' }
  ],
  enabledInsuranceTypes: [
    { code: 'MEDICAL', name: '医疗险', enabled: true },
    { code: 'LIFE', name: '寿险', enabled: true }
  ],
  assignableUsers: [
    { id: 'u_l1_1', name: '李一线', role: 'L1' },
    { id: 'u_l1_2', name: '周一线', role: 'L1' }
  ]
};

test('insurance type validation requires unique code and name', () => {
  const existingItems = [
    { id: 'ins_1', type: INSURANCE_DICTIONARY_TYPE, code: 'MEDICAL', name: '医疗险', enabled: true }
  ];

  assert.deepEqual(validateInsuranceTypeInput({ code: '', name: '' }, existingItems).errors, [
    { path: ['code'], message: '请输入险种编码' },
    { path: ['name'], message: '请输入险种名称' }
  ]);

  assert.deepEqual(validateInsuranceTypeInput({ code: ' medical ', name: '其他' }, existingItems).errors, [
    { path: ['code'], message: '险种编码已存在' }
  ]);

  assert.deepEqual(validateInsuranceTypeInput({ code: 'OTHER', name: '医疗险' }, existingItems).errors, [
    { path: ['name'], message: '险种名称已存在' }
  ]);
});

test('insurance type validation allows editing current item without duplicate errors', () => {
  const existingItems = [
    { id: 'ins_1', type: INSURANCE_DICTIONARY_TYPE, code: 'MEDICAL', name: '医疗险', enabled: true }
  ];

  const result = validateInsuranceTypeInput(
    { code: ' medical ', name: ' 医疗险 ', enabled: false },
    existingItems,
    'ins_1'
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    code: 'MEDICAL',
    name: '医疗险',
    enabled: false
  });
});

test('schedule validation requires each group to have systems and a base schedule', () => {
  const result = validateScheduleConfig(
    {
      groups: [
        {
          id: 'grp_1',
          name: '',
          systemCodes: [],
          baseSchedule: { userIds: [] },
          insuranceTeams: []
        }
      ]
    },
    scheduleContext
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['groups', 0, 'name'], message: '请输入排班分组名称' },
    { path: ['groups', 0, 'systemCodes'], message: '请选择系统' },
    { path: ['groups', 0, 'baseSchedule', 'userIds'], message: '基础排班至少选择一名一线人员' }
  ]);
});

test('schedule validation rejects duplicate systems across groups', () => {
  const result = validateScheduleConfig(
    {
      groups: [
        {
          id: 'grp_1',
          name: 'ERP 组',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: ['u_l1_1'] },
          insuranceTeams: []
        },
        {
          id: 'grp_2',
          name: '重复系统组',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: ['u_l1_2'] },
          insuranceTeams: []
        }
      ]
    },
    scheduleContext
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['groups', 1, 'systemCodes'], message: 'ERP 核心系统已出现在其他排班分组中' }
  ]);
});

test('schedule validation rejects duplicate insurance and users within one group teams', () => {
  const result = validateScheduleConfig(
    {
      groups: [
        {
          id: 'grp_1',
          name: 'ERP 组',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: ['u_l1_1'] },
          insuranceTeams: [
            {
              id: 'team_1',
              name: '医疗险小组',
              userIds: ['u_l1_1'],
              insuranceTypeCodes: ['MEDICAL']
            },
            {
              id: 'team_2',
              name: '重复小组',
              userIds: ['u_l1_1'],
              insuranceTypeCodes: ['MEDICAL']
            }
          ]
        }
      ]
    },
    scheduleContext
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['groups', 0, 'insuranceTeams', 1, 'userIds'], message: '李一线 已出现在本分组其他险种小组中' },
    { path: ['groups', 0, 'insuranceTeams', 1, 'insuranceTypeCodes'], message: '医疗险 已出现在本分组其他险种小组中' }
  ]);
});

test('schedule validation rejects non-L1 users and disabled insurance references', () => {
  const result = validateScheduleConfig(
    {
      groups: [
        {
          id: 'grp_1',
          name: 'ERP 组',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: ['u_l2_1'] },
          insuranceTeams: [
            {
              id: 'team_1',
              name: '医疗险小组',
              userIds: ['u_l2_1'],
              insuranceTypeCodes: ['DISABLED']
            }
          ]
        }
      ]
    },
    scheduleContext
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['groups', 0, 'baseSchedule', 'userIds'], message: '人员 u_l2_1 不是可选一线人员' },
    { path: ['groups', 0, 'insuranceTeams', 0, 'userIds'], message: '人员 u_l2_1 不是可选一线人员' },
    { path: ['groups', 0, 'insuranceTeams', 0, 'insuranceTypeCodes'], message: '险种 DISABLED 不存在或未启用' }
  ]);
});

test('schedule validation allows the same person in different groups', () => {
  const result = validateScheduleConfig(
    {
      groups: [
        {
          id: 'grp_1',
          name: 'ERP 组',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds: ['u_l1_1'] },
          insuranceTeams: [
            {
              id: 'team_1',
              name: '医疗险小组',
              userIds: ['u_l1_1'],
              insuranceTypeCodes: ['MEDICAL']
            }
          ]
        },
        {
          id: 'grp_2',
          name: 'CRM 组',
          systemCodes: ['CRM_CENTER'],
          baseSchedule: { userIds: ['u_l1_1'] },
          insuranceTeams: [
            {
              id: 'team_2',
              name: '寿险小组',
              userIds: ['u_l1_1'],
              insuranceTypeCodes: ['LIFE']
            }
          ]
        }
      ]
    },
    scheduleContext
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('support rest validation requires L1 users and valid time ranges', () => {
  assert.equal(SUPPORT_REST_CONFIG_KEY, 'SUPPORT_REST_CONFIG');

  const result = validateSupportRestConfig(
    {
      restPeriods: [
        {
          id: 'rest_invalid',
          userIds: [],
          startsAt: '2026-05-18T10:00:00.000Z',
          endsAt: '2026-05-18T09:00:00.000Z',
          reason: '时间错误'
        }
      ]
    },
    { assignableUsers: scheduleContext.assignableUsers }
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['restPeriods', 0, 'userIds'], message: '请选择一线技术支持人员' },
    { path: ['restPeriods', 0, 'endsAt'], message: '结束时间必须晚于开始时间' }
  ]);
});

test('support rest validation rejects non-L1 users and overlapping periods for the same person', () => {
  const result = validateSupportRestConfig(
    {
      restPeriods: [
        {
          id: 'rest_1',
          userIds: ['u_l1_1', 'u_l2_1'],
          startsAt: '2026-05-18T09:00:00.000Z',
          endsAt: '2026-05-18T12:00:00.000Z',
          reason: '上午'
        },
        {
          id: 'rest_2',
          userIds: ['u_l1_1'],
          startsAt: '2026-05-18T11:00:00.000Z',
          endsAt: '2026-05-18T13:00:00.000Z',
          reason: '重叠'
        }
      ]
    },
    { assignableUsers: scheduleContext.assignableUsers }
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['restPeriods', 0, 'userIds'], message: '人员 u_l2_1 不是可选一线人员' },
    { path: ['restPeriods', 1, 'startsAt'], message: '李一线 存在重叠休息时间' }
  ]);
});

test('support rest validation allows adjacent periods and normalizes ids and reasons', () => {
  const result = validateSupportRestConfig(
    {
      restPeriods: [
        {
          userIds: ['u_l1_1'],
          startsAt: '2026-05-18T09:00:00.000Z',
          endsAt: '2026-05-18T12:00:00.000Z',
          reason: ' 上午调休 '
        },
        {
          id: 'rest_adjacent',
          userIds: ['u_l1_1'],
          startsAt: '2026-05-18T12:00:00.000Z',
          endsAt: '2026-05-18T18:00:00.000Z',
          reason: ''
        }
      ]
    },
    { assignableUsers: scheduleContext.assignableUsers }
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.restPeriods[0].id, 'rest_1');
  assert.equal(result.value.restPeriods[0].reason, '上午调休');
  assert.equal(result.value.restPeriods[1].id, 'rest_adjacent');
});

test('upcoming support rest days include future and cross-day periods grouped by date', () => {
  const crossDayStart = dayjs('2026-05-18').hour(22).minute(0).second(0).millisecond(0);
  const crossDayEnd = dayjs('2026-05-19').hour(2).minute(0).second(0).millisecond(0);
  const days = buildUpcomingSupportRestDays(
    {
      restPeriods: [
        {
          id: 'rest_cross_day',
          userIds: ['u_l1_1', 'u_l1_2'],
          startsAt: crossDayStart.toISOString(),
          endsAt: crossDayEnd.toISOString(),
          reason: '夜间调休'
        },
        {
          id: 'rest_outside',
          userIds: ['u_l1_1'],
          startsAt: '2026-06-30T09:00:00.000Z',
          endsAt: '2026-06-30T10:00:00.000Z',
          reason: '太远'
        }
      ]
    },
    scheduleContext.assignableUsers,
    { from: '2026-05-18T00:00:00.000Z', days: 2 }
  );

  assert.deepEqual(days.map((day) => day.date), ['2026-05-18', '2026-05-19']);
  assert.equal(days[0].items[0].id, 'rest_cross_day');
  assert.equal(days[1].items[0].id, 'rest_cross_day');
  assert.deepEqual(days[0].items[0].userNames, ['李一线', '周一线']);
  assert.deepEqual(days[1].items[0].userNames, ['李一线', '周一线']);
  assert.equal(days[0].items[0].dayStartsAt < days[0].items[0].dayEndsAt, true);
  assert.equal(days[1].items[0].dayStartsAt < days[1].items[0].dayEndsAt, true);
});
