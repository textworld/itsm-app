/**
 * localStorage 访问封装 + 数据初始化/导出
 *
 * 存储键：
 *   itsm_tickets         工单列表
 *   itsm_defects         项目缺陷池
 *   itsm_current_user    当前登录用户
 *
 * 规则：
 *   1. 启动时若 key 不存在，则用初始 json 数据回填（保证首次打开即有可看工单）
 *   2. 重置：将初始数据覆盖写入 localStorage
 *   3. 导出：将 localStorage 中当前工单以 json 文件下载
 */
import initialTickets from '../mock/initialTickets.json';
import initialDefects from '../mock/initialDefects.json';
import { withDualStatuses } from '../constants/ticketStatus.js';

export const STORAGE_KEYS = {
  TICKETS: 'itsm_tickets',
  DEFECTS: 'itsm_defects',
  CURRENT_USER: 'itsm_current_user',
  MESSAGE_READS: 'itsm_message_reads'
};

/** 安全读取 localStorage */
function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** 安全写入 localStorage */
function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[storage] 写入 ${key} 失败:`, err);
  }
}

/** 启动时幂等初始化：若 key 不存在则写入初始数据 */
export function bootstrapStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.TICKETS)) {
    safeWrite(STORAGE_KEYS.TICKETS, initialTickets);
  }
  if (!localStorage.getItem(STORAGE_KEYS.DEFECTS)) {
    safeWrite(STORAGE_KEYS.DEFECTS, initialDefects);
  }
}

/** 读取全部工单 */
export function loadTickets() {
  return safeRead(STORAGE_KEYS.TICKETS, []).map(withDualStatuses);
}

/** 保存全部工单 */
export function saveTickets(tickets) {
  safeWrite(STORAGE_KEYS.TICKETS, tickets);
}

/** 读取项目缺陷池 */
export function loadDefects() {
  return safeRead(STORAGE_KEYS.DEFECTS, []);
}

/** 保存项目缺陷池（当一线"创建新缺陷"时会追加） */
export function saveDefects(defects) {
  safeWrite(STORAGE_KEYS.DEFECTS, defects);
}

export function loadMessageReads() {
  return safeRead(STORAGE_KEYS.MESSAGE_READS, {});
}

export function saveMessageReads(reads) {
  safeWrite(STORAGE_KEYS.MESSAGE_READS, reads);
}

/** 读取当前登录用户 */
export function loadCurrentUser() {
  return safeRead(STORAGE_KEYS.CURRENT_USER, null);
}

/** 保存 / 清除当前登录用户 */
export function saveCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    return;
  }
  safeWrite(STORAGE_KEYS.CURRENT_USER, user);
}

/**
 * 重置工单 + 缺陷为初始 json 数据
 * 注意：不会清除登录状态
 */
export function resetAllData() {
  safeWrite(STORAGE_KEYS.TICKETS, initialTickets);
  safeWrite(STORAGE_KEYS.DEFECTS, initialDefects);
  safeWrite(STORAGE_KEYS.MESSAGE_READS, {});
}

/**
 * 导出工单数据为 json 文件（通过创建临时 a 标签触发下载）
 */
export function exportTicketsAsJson() {
  const tickets = loadTickets();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `itsm-tickets-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const blob = new Blob([JSON.stringify(tickets, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}
