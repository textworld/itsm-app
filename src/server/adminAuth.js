import { ROLES } from '../constants/roles.js';

const ANNOUNCEMENT_MANAGER_ROLES = new Set([ROLES.ADMIN, ROLES.L1, ROLES.L2]);

export function requireAdminUser(user) {
  if (!user) {
    return { ok: false, status: 401, reason: '未登录' };
  }

  if (user.role !== ROLES.ADMIN) {
    return { ok: false, status: 403, reason: '无管理员权限' };
  }

  return { ok: true, user };
}

export function requireAnnouncementManagerUser(user) {
  if (!user) {
    return { ok: false, status: 401, reason: '未登录' };
  }

  if (!ANNOUNCEMENT_MANAGER_ROLES.has(user.role)) {
    return { ok: false, status: 403, reason: '无公告管理权限' };
  }

  return { ok: true, user };
}
