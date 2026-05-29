import { ROLES } from '../constants/roles.js';
import { INSURANCE_DICTIONARY_TYPE } from './adminConfigValidation.js';

const ONLINE_STATUS = 'ONLINE';

export function routeScheduleAssignee(ticket = {}, scheduleConfig = {}, users = [], previousTickets = []) {
  const systemCode = normalizeCode(ticket.systemCode || ticket.systemName);
  if (!systemCode) return null;

  const group = (scheduleConfig.groups || []).find((item) =>
    (item.systemCodes || []).some((code) => normalizeCode(code) === systemCode)
  );
  if (!group) return null;

  const usersById = new Map(
    users
      .filter((user) => user?.role === ROLES.L1)
      .filter((user) => isOnline(user))
      .map((user) => [user.id, user])
  );

  for (const route of buildRouteCandidates(ticket, group, systemCode)) {
    const sequence = route.sequence
      .map((userId) => usersById.get(userId))
      .filter(Boolean);
    if (!sequence.length) continue;

    const sequenceIndex = nextSequenceIndex(sequence, route.routeKey, previousTickets);
    const assignee = sequence[sequenceIndex];
    return {
      assignee: {
        id: assignee.id,
        name: assignee.name,
        role: assignee.role
      },
      ruleType: route.ruleType,
      groupId: group.id,
      ruleId: route.ruleId,
      routeKey: route.routeKey,
      sequenceIndex,
      sequenceLength: sequence.length
    };
  }

  return null;
}

function buildRouteCandidates(ticket, group, systemCode) {
  const routes = [];
  const insuranceCode = getInsuranceCode(ticket);
  if (insuranceCode) {
    const team = (group.insuranceTeams || []).find((item) =>
      (item.insuranceTypeCodes || []).some((code) => normalizeCode(code) === insuranceCode)
    );
    if (team) {
      routes.push({
        ruleType: 'INSURANCE_TEAM',
        ruleId: team.id,
        routeKey: `INSURANCE_TEAM:${group.id}:${team.id}`,
        sequence: uniqueStrings(team.userIds)
      });
    }
  }

  const flexibleRule = (group.flexibleRules || []).find((rule) =>
    (rule.systemCodes || []).some((code) => normalizeCode(code) === systemCode)
  );
  if (flexibleRule) {
    routes.push({
      ruleType: 'FLEXIBLE_RULE',
      ruleId: flexibleRule.id,
      routeKey: `FLEXIBLE_RULE:${group.id}:${flexibleRule.id}`,
      sequence: buildWeightedSequence(flexibleRule.assignees)
    });
  }

  routes.push({
    ruleType: 'BASE_SCHEDULE',
    ruleId: group.id,
    routeKey: `BASE_SCHEDULE:${group.id}`,
    sequence: uniqueStrings(group.baseSchedule?.userIds)
  });

  return routes;
}

function buildWeightedSequence(assignees = []) {
  const weighted = assignees
    .map((assignee) => ({
      userId: String(assignee.userId || '').trim(),
      weight: normalizeWeight(assignee.ratio)
    }))
    .filter((assignee) => assignee.userId && assignee.weight > 0);
  if (!weighted.length) return [];

  const divisor = weighted.reduce((value, assignee) => gcd(value, assignee.weight), weighted[0].weight);
  return weighted.flatMap((assignee) =>
    Array.from({ length: assignee.weight / divisor }, () => assignee.userId)
  );
}

function nextSequenceIndex(sequence, routeKey, previousTickets) {
  const previous = [...(previousTickets || [])]
    .filter((ticket) => ticket?.scheduleDispatch?.routeKey === routeKey)
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())[0];

  if (!previous) return 0;

  const storedIndex = Number(previous.scheduleDispatch?.sequenceIndex);
  if (Number.isInteger(storedIndex) && storedIndex >= 0) {
    return (storedIndex + 1) % sequence.length;
  }

  const previousAssigneeId = previous.assigneeL1Id;
  const previousIndex = sequence.findIndex((assignee) => assignee.id === previousAssigneeId);
  return previousIndex >= 0 ? (previousIndex + 1) % sequence.length : 0;
}

function getInsuranceCode(ticket = {}) {
  const classification = ticket.ticketClassification || {};
  const dictionaryType = normalizeCode(classification.dictionaryType);
  if (dictionaryType !== INSURANCE_DICTIONARY_TYPE) {
    return normalizeCode(ticket.insuranceTypeCode || ticket.insuranceCode);
  }
  return normalizeCode(classification.optionCode || classification.code || ticket.insuranceTypeCode);
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function isOnline(user) {
  const status = normalizeCode(user.availabilityStatus || ONLINE_STATUS);
  return status === ONLINE_STATUS;
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.max(1, Math.round(number));
}

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}
