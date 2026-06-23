import { TOOL_TYPES } from '../constants/toolTypes.js';

export const SLA_CONFIG_KEY = 'SLA_CONFIG';
export const SLA_CHANNELS = [
  TOOL_TYPES.DATA_EXTRACT,
  TOOL_TYPES.DATA_FIX,
  TOOL_TYPES.PERMISSION,
  TOOL_TYPES.CONSULT
];
export const SLA_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

export const SLA_TIME_NODES = {
  RESPONSE: 'response',
  FIRST_HANDLE: 'firstHandle',
  RESOLVE: 'resolve'
};

export const SLA_WARNING_TARGETS = ['ASSIGNEE', 'GROUP_LEADER', 'DEPARTMENT_LEADER', 'ADMIN'];
export const SLA_NOTIFICATION_CHANNELS = ['DINGTALK', 'SYSTEM'];
export const SLA_ESCALATION_TARGETS = ['GROUP_LEADER', 'DEPARTMENT_LEADER', 'ADMIN'];

const DEFAULT_DURATIONS = {
  P0: { responseMinutes: 30, firstHandleMinutes: 60, resolveMinutes: 240 },
  P1: { responseMinutes: 60, firstHandleMinutes: 120, resolveMinutes: 480 },
  P2: { responseMinutes: 120, firstHandleMinutes: 240, resolveMinutes: 1440 },
  P3: { responseMinutes: 240, firstHandleMinutes: 480, resolveMinutes: 2880 }
};

export function buildDefaultSlaConfig() {
  const rules = {};
  for (const channel of SLA_CHANNELS) {
    rules[channel] = {};
    for (const priority of SLA_PRIORITIES) {
      rules[channel][priority] = normalizeSlaRule(DEFAULT_DURATIONS[priority]);
    }
  }
  return { rules, updatedAt: null, updatedBy: null };
}

export function normalizeSlaConfig(input = {}) {
  const defaults = buildDefaultSlaConfig();
  const rules = {};

  for (const channel of SLA_CHANNELS) {
    rules[channel] = {};
    for (const priority of SLA_PRIORITIES) {
      rules[channel][priority] = normalizeSlaRule(
        input.rules?.[channel]?.[priority] || defaults.rules[channel][priority]
      );
    }
  }

  return {
    rules,
    updatedAt: normalizeNullableString(input.updatedAt),
    updatedBy: input.updatedBy || null
  };
}

export function validateSlaConfig(input = {}) {
  const value = normalizeSlaConfig(input);
  const errors = [];

  for (const channel of SLA_CHANNELS) {
    for (const priority of SLA_PRIORITIES) {
      const rule = value.rules[channel][priority];
      const path = ['rules', channel, priority];
      if (rule.responseMinutes <= 0) errors.push({ path: [...path, 'responseMinutes'], message: '响应时效必须大于 0' });
      if (rule.firstHandleMinutes <= 0) errors.push({ path: [...path, 'firstHandleMinutes'], message: '首次处理时效必须大于 0' });
      if (rule.resolveMinutes <= 0) errors.push({ path: [...path, 'resolveMinutes'], message: '办结时效必须大于 0' });

      rule.warnings.forEach((warning, warningIndex) => {
        const warningPath = [...path, 'warnings', warningIndex];
        if (!Object.values(SLA_TIME_NODES).includes(warning.node)) {
          errors.push({ path: [...warningPath, 'node'], message: '预警节点不正确' });
        }
        if (warning.beforeMinutes <= 0) {
          errors.push({ path: [...warningPath, 'beforeMinutes'], message: '预警提前时间必须大于 0' });
        }
        if (!warning.targets.length) {
          errors.push({ path: [...warningPath, 'targets'], message: '请选择预警对象' });
        }
        if (!warning.channels.length) {
          errors.push({ path: [...warningPath, 'channels'], message: '请选择通知渠道' });
        }
        if (warning.frequencyMinutes <= 0) {
          errors.push({ path: [...warningPath, 'frequencyMinutes'], message: '通知频率必须大于 0' });
        }
      });

      rule.escalations.forEach((escalation, escalationIndex) => {
        const escalationPath = [...path, 'escalations', escalationIndex];
        if (escalation.afterMinutes <= 0) {
          errors.push({ path: [...escalationPath, 'afterMinutes'], message: '升级超时时间必须大于 0' });
        }
        if (!SLA_ESCALATION_TARGETS.includes(escalation.target)) {
          errors.push({ path: [...escalationPath, 'target'], message: '升级对象不正确' });
        }
      });
    }
  }

  return { ok: errors.length === 0, errors, value };
}

export function normalizeTicketPriorityToSlaPriority(priority) {
  const value = String(priority || '').trim().toUpperCase();
  if (SLA_PRIORITIES.includes(value)) return value;
  return 'P3';
}

export function findSlaRuleForTicket(ticket = {}, config = buildDefaultSlaConfig()) {
  const channel = String(ticket.toolType || '').trim().toUpperCase();
  if (!SLA_CHANNELS.includes(channel)) return null;
  const priority = normalizeTicketPriorityToSlaPriority(ticket.priority);
  const rule = normalizeSlaConfig(config).rules[channel]?.[priority];
  if (!rule || rule.enabled === false) return null;
  return {
    channel,
    priority,
    rule: cloneRule(rule)
  };
}

export function calculateSlaDeadlines(startedAt, rule = {}) {
  const startTime = Date.parse(startedAt);
  if (!Number.isFinite(startTime)) {
    return {
      responseDueAt: null,
      firstHandleDueAt: null,
      resolveDueAt: null
    };
  }
  return {
    responseDueAt: addMinutes(startTime, rule.responseMinutes),
    firstHandleDueAt: addMinutes(startTime, rule.firstHandleMinutes),
    resolveDueAt: addMinutes(startTime, rule.resolveMinutes)
  };
}

export function buildSlaSnapshot({ channel, priority, rule } = {}) {
  if (!channel || !priority || !rule) return null;
  return {
    channel,
    priority,
    enabled: rule.enabled !== false,
    responseMinutes: Number(rule.responseMinutes) || 0,
    firstHandleMinutes: Number(rule.firstHandleMinutes) || 0,
    resolveMinutes: Number(rule.resolveMinutes) || 0,
    warnings: rule.warnings ? JSON.parse(JSON.stringify(rule.warnings)) : [],
    escalations: rule.escalations ? JSON.parse(JSON.stringify(rule.escalations)) : []
  };
}

function normalizeSlaRule(input = {}) {
  return {
    enabled: input.enabled !== false,
    responseMinutes: normalizePositiveNumber(input.responseMinutes),
    firstHandleMinutes: normalizePositiveNumber(input.firstHandleMinutes),
    resolveMinutes: normalizePositiveNumber(input.resolveMinutes),
    warnings: Array.isArray(input.warnings) ? input.warnings.map(normalizeWarning) : [],
    escalations: Array.isArray(input.escalations) ? input.escalations.map(normalizeEscalation) : []
  };
}

function normalizeWarning(warning = {}, index = 0) {
  return {
    id: String(warning.id || `warning_${index + 1}`).trim(),
    node: String(warning.node || '').trim(),
    beforeMinutes: normalizePositiveNumber(warning.beforeMinutes),
    targets: uniqueKnownStrings(warning.targets, SLA_WARNING_TARGETS),
    channels: uniqueKnownStrings(warning.channels, SLA_NOTIFICATION_CHANNELS),
    frequencyMinutes: normalizePositiveNumber(warning.frequencyMinutes)
  };
}

function normalizeEscalation(escalation = {}, index = 0) {
  const target = String(escalation.target || '').trim();
  return {
    id: String(escalation.id || `escalation_${index + 1}`).trim(),
    afterMinutes: normalizePositiveNumber(escalation.afterMinutes),
    target,
    useOrgHierarchy: escalation.useOrgHierarchy === true
  };
}

function normalizePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeNullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function uniqueKnownStrings(values = [], knownValues = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter((item) => knownValues.includes(item)))];
}

function cloneRule(rule) {
  return JSON.parse(JSON.stringify(rule));
}

function addMinutes(startTime, minutes) {
  return new Date(startTime + (Number(minutes) || 0) * 60 * 1000).toISOString();
}
