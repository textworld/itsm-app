import { ROLES } from './roles.js';

export const INITIAL_SUPPORT_ACCOUNT_COUNT = 23;

const L1_NAME_STEMS = [
  '李',
  '周',
  '吴',
  '郑',
  '王',
  '冯',
  '陈',
  '褚',
  '卫',
  '章',
  '沈',
  '韩',
  '杨',
  '朱',
  '秦',
  '尤',
  '许',
  '何',
  '吕',
  '施',
  '张',
  '孔',
  '曹'
];

const L2_NAME_STEMS = [
  '王',
  '郑',
  '孙',
  '赵',
  '钱',
  '冯',
  '陈',
  '褚',
  '卫',
  '章',
  '沈',
  '韩',
  '杨',
  '朱',
  '秦',
  '尤',
  '许',
  '何',
  '吕',
  '施',
  '张',
  '孔',
  '曹'
];

function buildSupportUsers({ role, idPrefix, usernamePrefix, nameStems, lineLabel, department }) {
  return Array.from({ length: INITIAL_SUPPORT_ACCOUNT_COUNT }, (_, index) => {
    const number = index + 1;

    return {
      id: `${idPrefix}_${number}`,
      username: `${usernamePrefix}${number}`,
      password: '123456',
      name: `${nameStems[index]}${lineLabel}${number}`,
      role,
      department
    };
  });
}

export const INITIAL_L1_SUPPORT_USERS = buildSupportUsers({
  role: ROLES.L1,
  idPrefix: 'u_l1',
  usernamePrefix: 'support',
  nameStems: L1_NAME_STEMS,
  lineLabel: '一线',
  department: '技术支持中心'
});

export const INITIAL_L2_SUPPORT_USERS = buildSupportUsers({
  role: ROLES.L2,
  idPrefix: 'u_l2',
  usernamePrefix: 'ops',
  nameStems: L2_NAME_STEMS,
  lineLabel: '二线',
  department: '系统运维部'
});

export function getInitialSupportUsersByRole(role) {
  if (role === ROLES.L1) return [...INITIAL_L1_SUPPORT_USERS];
  if (role === ROLES.L2) return [...INITIAL_L2_SUPPORT_USERS];
  return [];
}

export function getSupportAssigneesByRole(role) {
  return getInitialSupportUsersByRole(role).map(({ id, name, role: userRole }) => ({
    id,
    name,
    role: userRole
  }));
}

export function getAllSupportAssignees() {
  return [
    ...getSupportAssigneesByRole(ROLES.L1),
    ...getSupportAssigneesByRole(ROLES.L2)
  ];
}
