import { ROLES } from '../constants/roles.js';

const ASSIGNABLE_SUBTASK_ASSIGNEES = [
  { id: 'u_l1_1', name: '李一线 (一线技术支持)', role: ROLES.L1 },
  { id: 'u_l1_2', name: '周一线 (一线技术支持)', role: ROLES.L1 },
  { id: 'u_l1_3', name: '吴一线 (一线技术支持)', role: ROLES.L1 },
  { id: 'u_l2_1', name: '王二线 (二线运维)', role: ROLES.L2 },
  { id: 'u_l2_2', name: '郑二线 (二线运维)', role: ROLES.L2 },
  { id: 'u_l2_3', name: '孙二线 (二线运维)', role: ROLES.L2 }
];

const DEFAULT_SUBTASK_ASSIGNEES = {
  ERP_CORE: ASSIGNABLE_SUBTASK_ASSIGNEES[0],
  FINANCE_BI: ASSIGNABLE_SUBTASK_ASSIGNEES[0],
  OA_CENTER: ASSIGNABLE_SUBTASK_ASSIGNEES[0],
  HR_MASTER: ASSIGNABLE_SUBTASK_ASSIGNEES[0],
  SUPPLY_CHAIN: ASSIGNABLE_SUBTASK_ASSIGNEES[0],
  MES_PORTAL: ASSIGNABLE_SUBTASK_ASSIGNEES[3],
  CRM_CENTER: ASSIGNABLE_SUBTASK_ASSIGNEES[3],
  OPS_MONITOR: ASSIGNABLE_SUBTASK_ASSIGNEES[3]
};

export function routeSubtaskAssignee(systemCode) {
  return DEFAULT_SUBTASK_ASSIGNEES[systemCode] || DEFAULT_SUBTASK_ASSIGNEES.ERP_CORE;
}

export function listSubtaskAssignees(systemCode) {
  const assignee = routeSubtaskAssignee(systemCode);
  return assignee?.id ? [assignee] : [];
}

export function listAssignableSubtaskAssignees() {
  return ASSIGNABLE_SUBTASK_ASSIGNEES;
}

export function canUserHandleSubtaskSystem(user, systemCode) {
  return listSubtaskAssignees(systemCode).some((assignee) => assignee.id === user?.id);
}
