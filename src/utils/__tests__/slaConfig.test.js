import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SLA_CHANNELS,
  SLA_CONFIG_KEY,
  SLA_PRIORITIES,
  buildDefaultSlaConfig,
  calculateSlaDeadlines,
  findSlaRuleForTicket,
  normalizeSlaConfig,
  normalizeTicketPriorityToSlaPriority,
  validateSlaConfig
} from '../slaConfig.js';

test('default SLA config covers four channels and P0-P3 priorities', () => {
  const config = buildDefaultSlaConfig();

  assert.equal(SLA_CONFIG_KEY, 'SLA_CONFIG');
  assert.deepEqual(SLA_PRIORITIES, ['P0', 'P1', 'P2', 'P3']);
  assert.deepEqual(SLA_CHANNELS, ['DATA_EXTRACT', 'DATA_FIX', 'PERMISSION', 'CONSULT']);
  assert.equal(Object.keys(config.rules).length, 4);
  assert.equal(Object.keys(config.rules.DATA_EXTRACT).length, 4);
  assert.equal(config.rules.DATA_EXTRACT.P0.enabled, true);
  assert.equal(config.rules.DATA_EXTRACT.P0.responseMinutes > 0, true);
});

test('normalizeSlaConfig keeps valid warnings escalations and coerces numbers', () => {
  const config = normalizeSlaConfig({
    rules: {
      DATA_EXTRACT: {
        P0: {
          enabled: false,
          responseMinutes: '15',
          firstHandleMinutes: '30',
          resolveMinutes: '120',
          warnings: [
            {
              node: 'response',
              beforeMinutes: '60',
              targets: ['ASSIGNEE', 'GROUP_LEADER'],
              channels: ['DINGTALK'],
              frequencyMinutes: '30'
            }
          ],
          escalations: [
            {
              afterMinutes: '60',
              target: 'GROUP_LEADER',
              useOrgHierarchy: true
            }
          ]
        }
      }
    }
  });

  assert.equal(config.rules.DATA_EXTRACT.P0.enabled, false);
  assert.equal(config.rules.DATA_EXTRACT.P0.responseMinutes, 15);
  assert.equal(config.rules.DATA_EXTRACT.P0.warnings[0].node, 'response');
  assert.equal(config.rules.DATA_EXTRACT.P0.escalations[0].target, 'GROUP_LEADER');
});

test('validateSlaConfig rejects invalid durations warning nodes and escalation targets', () => {
  const result = validateSlaConfig({
    rules: {
      DATA_EXTRACT: {
        P0: {
          enabled: true,
          responseMinutes: 0,
          firstHandleMinutes: -1,
          resolveMinutes: 0,
          warnings: [{ node: 'bad', beforeMinutes: 0, targets: [], channels: [], frequencyMinutes: 0 }],
          escalations: [{ afterMinutes: 0, target: 'bad' }]
        }
      }
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((item) => item.message), [
    '响应时效必须大于 0',
    '首次处理时效必须大于 0',
    '办结时效必须大于 0',
    '预警节点不正确',
    '预警提前时间必须大于 0',
    '请选择预警对象',
    '请选择通知渠道',
    '通知频率必须大于 0',
    '升级超时时间必须大于 0',
    '升级对象不正确'
  ]);
});

test('ticket priorities use unified SLA P0-P3 values while preserving fallback for legacy values', () => {
  assert.equal(normalizeTicketPriorityToSlaPriority('P0'), 'P0');
  assert.equal(normalizeTicketPriorityToSlaPriority('P1'), 'P1');
  assert.equal(normalizeTicketPriorityToSlaPriority('P2'), 'P2');
  assert.equal(normalizeTicketPriorityToSlaPriority('P3'), 'P3');
  assert.equal(normalizeTicketPriorityToSlaPriority('P4'), 'P3');
  assert.equal(normalizeTicketPriorityToSlaPriority('unknown'), 'P3');
});

test('findSlaRuleForTicket returns enabled rule snapshot and deadlines use submitted time', () => {
  const config = normalizeSlaConfig({
    rules: {
      DATA_FIX: {
        P2: {
          enabled: true,
          responseMinutes: 10,
          firstHandleMinutes: 20,
          resolveMinutes: 30
        }
      }
    }
  });
  const ticket = { toolType: 'DATA_FIX', priority: 'P2' };
  const match = findSlaRuleForTicket(ticket, config);
  const deadlines = calculateSlaDeadlines('2026-06-12T00:00:00.000Z', match.rule);

  assert.equal(match.channel, 'DATA_FIX');
  assert.equal(match.priority, 'P2');
  assert.equal(match.rule.resolveMinutes, 30);
  assert.deepEqual(deadlines, {
    responseDueAt: '2026-06-12T00:10:00.000Z',
    firstHandleDueAt: '2026-06-12T00:20:00.000Z',
    resolveDueAt: '2026-06-12T00:30:00.000Z'
  });
});

test('findSlaRuleForTicket returns null for disabled or unknown channel rules', () => {
  const config = normalizeSlaConfig({
    rules: {
      DATA_FIX: {
        P2: {
          enabled: false,
          responseMinutes: 10,
          firstHandleMinutes: 20,
          resolveMinutes: 30
        }
      }
    }
  });

  assert.equal(findSlaRuleForTicket({ toolType: 'DATA_FIX', priority: 'P2' }, config), null);
  assert.equal(findSlaRuleForTicket({ toolType: 'OTHER', priority: 'P2' }, config), null);
});
