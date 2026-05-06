import { ROLES } from '../../constants/roles.js';

export const DEMO_LOGIN_ACCOUNTS = [
  {
    role: ROLES.REQUESTER,
    username: 'test_user',
    password: '123456',
    name: '张三'
  },
  {
    role: ROLES.REQUESTER,
    username: 'test_user2',
    password: '123456',
    name: '赵四'
  },
  {
    role: ROLES.REQUESTER,
    username: 'test_user3',
    password: '123456',
    name: '钱五'
  },
  {
    role: ROLES.L1,
    username: 'support1',
    password: '123456',
    name: '李一线'
  },
  {
    role: ROLES.L1,
    username: 'support2',
    password: '123456',
    name: '周一线'
  },
  {
    role: ROLES.L1,
    username: 'support3',
    password: '123456',
    name: '吴一线'
  },
  {
    role: ROLES.L2,
    username: 'ops1',
    password: '123456',
    name: '王二线'
  },
  {
    role: ROLES.L2,
    username: 'ops2',
    password: '123456',
    name: '郑二线'
  },
  {
    role: ROLES.L2,
    username: 'ops3',
    password: '123456',
    name: '孙二线'
  },
  {
    role: ROLES.ADMIN,
    username: 'admin',
    password: '123456',
    name: '管理员'
  }
];

export function getDemoLoginAccountsByRole(role) {
  return DEMO_LOGIN_ACCOUNTS.filter((account) => account.role === role);
}
