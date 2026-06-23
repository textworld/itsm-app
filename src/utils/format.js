/**
 * 通用格式化工具
 */
export function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function byCreatedAtDesc(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function byCreatedAtAsc(a, b) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
