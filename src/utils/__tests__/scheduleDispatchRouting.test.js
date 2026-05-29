import test from 'node:test';
import assert from 'node:assert/strict';

import { routeScheduleAssignee } from '../scheduleDispatchRouting.js';

const users = [
  { id: 'u_l1_1', name: 'L1 One', role: 'L1', availabilityStatus: 'ONLINE' },
  { id: 'u_l1_2', name: 'L1 Two', role: 'L1', availabilityStatus: 'ONLINE' },
  { id: 'u_l1_3', name: 'L1 Three', role: 'L1', availabilityStatus: 'ONLINE' },
  { id: 'u_l1_4', name: 'L1 Four', role: 'L1', availabilityStatus: 'ONLINE' },
  { id: 'u_l1_5', name: 'L1 Five', role: 'L1', availabilityStatus: 'OFFLINE' }
];

test('routes matching insurance tickets to the insurance team before flexible and base rules', () => {
  const result = routeScheduleAssignee(
    {
      id: 'TKT-1',
      systemCode: 'ERP_CORE',
      ticketClassification: {
        dictionaryType: 'INSURANCE_TYPE',
        optionCode: 'MEDICAL'
      }
    },
    buildScheduleConfig(),
    users,
    []
  );

  assert.equal(result.assignee.id, 'u_l1_2');
  assert.equal(result.ruleType, 'INSURANCE_TEAM');
  assert.equal(result.routeKey, 'INSURANCE_TEAM:grp_erp:team_medical');
});

test('routes matching flexible rules before base schedule when no insurance team matches', () => {
  const result = routeScheduleAssignee(
    {
      id: 'TKT-2',
      systemCode: 'ERP_CORE'
    },
    buildScheduleConfig(),
    users,
    []
  );

  assert.equal(result.assignee.id, 'u_l1_3');
  assert.equal(result.ruleType, 'FLEXIBLE_RULE');
  assert.equal(result.routeKey, 'FLEXIBLE_RULE:grp_erp:flex_erp');
});

test('falls back to base schedule when no insurance or flexible rule matches', () => {
  const result = routeScheduleAssignee(
    {
      id: 'TKT-3',
      systemCode: 'CRM_CENTER'
    },
    buildScheduleConfig(),
    users,
    []
  );

  assert.equal(result.assignee.id, 'u_l1_1');
  assert.equal(result.ruleType, 'BASE_SCHEDULE');
  assert.equal(result.routeKey, 'BASE_SCHEDULE:grp_crm');
});

test('uses weighted round-robin for flexible rule ratios', () => {
  const config = buildScheduleConfig();
  const first = routeScheduleAssignee({ id: 'TKT-4', systemCode: 'ERP_CORE' }, config, users, []);
  const second = routeScheduleAssignee({ id: 'TKT-5', systemCode: 'ERP_CORE' }, config, users, [
    buildPreviousTicket(first, '2026-05-26T01:00:00.000Z')
  ]);
  const third = routeScheduleAssignee({ id: 'TKT-6', systemCode: 'ERP_CORE' }, config, users, [
    buildPreviousTicket(first, '2026-05-26T01:00:00.000Z'),
    buildPreviousTicket(second, '2026-05-26T02:00:00.000Z')
  ]);

  assert.equal(first.assignee.id, 'u_l1_3');
  assert.equal(second.assignee.id, 'u_l1_3');
  assert.equal(third.assignee.id, 'u_l1_4');
});

test('skips offline assignees and continues to the next available fallback rule', () => {
  const result = routeScheduleAssignee(
    {
      id: 'TKT-7',
      systemCode: 'MES_PORTAL',
      ticketClassification: {
        dictionaryType: 'INSURANCE_TYPE',
        optionCode: 'LIFE'
      }
    },
    buildScheduleConfig(),
    users,
    []
  );

  assert.equal(result.assignee.id, 'u_l1_1');
  assert.equal(result.ruleType, 'BASE_SCHEDULE');
});

function buildScheduleConfig() {
  return {
    groups: [
      {
        id: 'grp_erp',
        name: 'ERP group',
        systemCodes: ['ERP_CORE'],
        baseSchedule: { userIds: ['u_l1_1'] },
        insuranceTeams: [
          {
            id: 'team_medical',
            name: 'Medical team',
            userIds: ['u_l1_2'],
            insuranceTypeCodes: ['MEDICAL']
          }
        ],
        flexibleRules: [
          {
            id: 'flex_erp',
            systemCodes: ['ERP_CORE'],
            assignees: [
              { userId: 'u_l1_3', ratio: 2 },
              { userId: 'u_l1_4', ratio: 1 }
            ]
          }
        ]
      },
      {
        id: 'grp_crm',
        name: 'CRM group',
        systemCodes: ['CRM_CENTER'],
        baseSchedule: { userIds: ['u_l1_1', 'u_l1_2'] },
        insuranceTeams: [],
        flexibleRules: []
      },
      {
        id: 'grp_mes',
        name: 'MES group',
        systemCodes: ['MES_PORTAL'],
        baseSchedule: { userIds: ['u_l1_1'] },
        insuranceTeams: [
          {
            id: 'team_life',
            name: 'Life team',
            userIds: ['u_l1_5'],
            insuranceTypeCodes: ['LIFE']
          }
        ],
        flexibleRules: []
      }
    ]
  };
}

function buildPreviousTicket(result, updatedAt) {
  return {
    id: `PREV-${updatedAt}`,
    assigneeL1Id: result.assignee.id,
    assigneeL1Name: result.assignee.name,
    updatedAt,
    scheduleDispatch: {
      routeKey: result.routeKey,
      sequenceIndex: result.sequenceIndex
    }
  };
}
