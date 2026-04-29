import { ROLES } from '../constants/roles.js';

const SAME_ROLE_ASSIGNEES = {
  [ROLES.L1]: [
    { id: 'u_l1_1', name: '李一线 (一线技术支持)' }
  ],
  [ROLES.L2]: [
    { id: 'u_l2_1', name: '王二线 (二线运维)' }
  ]
};

export function listSameRoleAssignees(role) {
  return SAME_ROLE_ASSIGNEES[role] || [];
}

export function routeTechTransferAssignee(role) {
  return listSameRoleAssignees(role)[0] || { id: null, name: null };
}
