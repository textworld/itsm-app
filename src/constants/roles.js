/**
 * 角色枚举
 * - REQUESTER 提单人
 * - L1        一线技术支持
 * - L2        二线运维
 */
export const ROLES = {
  REQUESTER: 'REQUESTER',
  L1: 'L1',
  L2: 'L2'
};

export const ROLE_LABELS = {
  [ROLES.REQUESTER]: '提单人',
  [ROLES.L1]: '一线技术支持',
  [ROLES.L2]: '二线运维'
};

export const ROLE_OPTIONS = [
  { label: ROLE_LABELS[ROLES.REQUESTER], value: ROLES.REQUESTER },
  { label: ROLE_LABELS[ROLES.L1], value: ROLES.L1 },
  { label: ROLE_LABELS[ROLES.L2], value: ROLES.L2 }
];
