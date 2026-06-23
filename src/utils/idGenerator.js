/**
 * 工单编号生成器
 * 格式：TKT-YYYYMMDD-XXXX (XXXX 为当日递增 4 位序号)
 */
function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * 基于现有工单列表，生成下一个不重复的工单号
 * @param {Array} existingTickets - 现有工单（用于判重并推导当日最大序号）
 */
export function generateTicketId(existingTickets = []) {
  const date = todayStr();
  const prefix = `TKT-${date}-`;
  const todaysIds = existingTickets
    .map((t) => t.id)
    .filter((id) => typeof id === 'string' && id.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (todaysIds.length ? Math.max(...todaysIds) : 0) + 1;
  return `${prefix}${pad(next, 4)}`;
}

/** 留言、缺陷、附件等通用短 id */
export function shortId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
