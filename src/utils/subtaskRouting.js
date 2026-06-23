import { ROLES } from '../constants/roles.js';
import {
  getAllSupportAssignees,
  getSupportAssigneesByRole
} from '../constants/supportAccounts.js';

const DEFAULT_L1_ASSIGNEE = getSupportAssigneesByRole(ROLES.L1)[0];
const DEFAULT_L2_ASSIGNEE = getSupportAssigneesByRole(ROLES.L2)[0];

const DEFAULT_SUBTASK_ASSIGNEES = {
  ERP_CORE: DEFAULT_L1_ASSIGNEE,
  FINANCE_BI: DEFAULT_L1_ASSIGNEE,
  OA_CENTER: DEFAULT_L1_ASSIGNEE,
  HR_MASTER: DEFAULT_L1_ASSIGNEE,
  SUPPLY_CHAIN: DEFAULT_L1_ASSIGNEE,
  MES_PORTAL: DEFAULT_L2_ASSIGNEE,
  CRM_CENTER: DEFAULT_L2_ASSIGNEE,
  OPS_MONITOR: DEFAULT_L2_ASSIGNEE
};

export function routeSubtaskAssignee(systemCode) {
  return DEFAULT_SUBTASK_ASSIGNEES[systemCode] || DEFAULT_SUBTASK_ASSIGNEES.ERP_CORE;
}

export function listSubtaskAssignees(systemCode) {
  const assignee = routeSubtaskAssignee(systemCode);
  return assignee?.id ? [assignee] : [];
}

export function listAssignableSubtaskAssignees() {
  return getAllSupportAssignees();
}

export function canUserHandleSubtaskSystem(user, systemCode) {
  return listSubtaskAssignees(systemCode).some((assignee) => assignee.id === user?.id);
}
