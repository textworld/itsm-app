import { ROLES } from '../constants/roles.js';

export function requireAdminUser(user) {
  if (!user) {
    return { ok: false, status: 401, reason: '未登录' };
  }

  if (user.role !== ROLES.ADMIN) {
    return { ok: false, status: 403, reason: '无管理员权限' };
  }

  return { ok: true, user };
}
