import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScheduleGroupRow,
  filterScheduleGroups
} from '../scheduleConfigViewModel.js';

const systems = [
  { value: 'ERP_CORE', label: 'ERP 核心系统' },
  { value: 'CRM_CENTER', label: 'CRM 客户管理系统' }
];

const users = [
  { id: 'u_l1_1', username: 'support1', name: '张一线' },
  { id: 'u_l1_2', username: 'support2', name: '李一线' },
  { id: 'u_l1_3', username: 'support3', name: '王一线' }
];

const context = { systems, users };

const groups = [
  {
    id: 'grp_erp',
    name: 'ERP 排班组',
    systemCodes: ['ERP_CORE'],
    baseSchedule: { userIds: ['u_l1_1'] },
    insuranceTeams: [
      {
        id: 'team_medical',
        name: '医疗险小组',
        userIds: ['u_l1_2'],
        insuranceTypeCodes: ['MEDICAL']
      }
    ],
    flexibleRules: [
      {
        id: 'flex_erp',
        systemCodes: ['ERP_CORE'],
        assignees: [
          { userId: 'u_l1_3', ratio: 60 }
        ]
      }
    ]
  },
  {
    id: 'grp_crm',
    name: 'CRM 排班组',
    systemCodes: ['CRM_CENTER'],
    baseSchedule: { userIds: ['u_l1_3'] },
    insuranceTeams: []
  }
];

test('buildScheduleGroupRow maps systems and summarizes base and team users', () => {
  const row = buildScheduleGroupRow(groups[0], context);

  assert.equal(row.key, 'grp_erp');
  assert.equal(row.name, 'ERP 排班组');
  assert.equal(row.systemSummary, 'ERP 核心系统');
  assert.equal(row.userSummary, '基础：张一线；险种排班：李一线；灵活规则：王一线(60)');
});

test('filterScheduleGroups matches system labels and codes', () => {
  assert.deepEqual(
    filterScheduleGroups(groups, { systemKeyword: '核心' }, context).map((group) => group.id),
    ['grp_erp']
  );

  assert.deepEqual(
    filterScheduleGroups(groups, { systemKeyword: 'CRM_CENTER' }, context).map((group) => group.id),
    ['grp_crm']
  );
});

test('filterScheduleGroups matches base and insurance team user names, usernames, and ids', () => {
  assert.deepEqual(
    filterScheduleGroups(groups, { userKeyword: 'support1' }, context).map((group) => group.id),
    ['grp_erp']
  );

  assert.deepEqual(
    filterScheduleGroups(groups, { userKeyword: '李一线' }, context).map((group) => group.id),
    ['grp_erp']
  );

  assert.deepEqual(
    filterScheduleGroups(groups, { userKeyword: 'u_l1_3' }, context).map((group) => group.id),
    ['grp_erp', 'grp_crm']
  );
});
