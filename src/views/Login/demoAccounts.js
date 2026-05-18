import { ROLES } from '../../constants/roles.js';
import {
  INITIAL_L1_SUPPORT_USERS,
  INITIAL_L2_SUPPORT_USERS
} from '../../constants/supportAccounts.js';

function toDemoAccount({ role, username, password, name }) {
  return {
    role,
    username,
    password,
    name
  };
}

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
  ...INITIAL_L1_SUPPORT_USERS.map(toDemoAccount),
  ...INITIAL_L2_SUPPORT_USERS.map(toDemoAccount),
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
