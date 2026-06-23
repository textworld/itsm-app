import { ROLES } from '../constants/roles.js';
import { getSupportAssigneesByRole } from '../constants/supportAccounts.js';

export function listSameRoleAssignees(role) {
  if (![ROLES.L1, ROLES.L2].includes(role)) return [];
  return getSupportAssigneesByRole(role).map(({ id, name }) => ({ id, name }));
}

export function routeTechTransferAssignee(role, excludedUserId = null, assignees = listSameRoleAssignees(role)) {
  return (
    assignees.find((assignee) => assignee.id !== excludedUserId) ||
    { id: null, name: null }
  );
}

export function routeRandomTechTransferAssignee(
  role,
  excludedUserId = null,
  random = Math.random,
  assignees = listSameRoleAssignees(role)
) {
  const candidates = assignees.filter((assignee) => assignee.id !== excludedUserId);
  if (!candidates.length) {
    return { id: null, name: null };
  }

  const randomValue = Number(random());
  const boundedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999)
    : 0;
  return candidates[Math.floor(boundedRandom * candidates.length)];
}
