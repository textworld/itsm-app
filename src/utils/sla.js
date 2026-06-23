import { PRIORITIES, PRIORITY_ORDER, PRIORITY_SLA_MINUTES } from '../constants/priorities.js';
import { STATUS } from '../constants/ticketStatus.js';

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;

export function calculateTicketExpiresAt(createdAt, priority = PRIORITIES.P4) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return null;

  const slaMinutes = PRIORITY_SLA_MINUTES[priority] || PRIORITY_SLA_MINUTES[PRIORITIES.P4];
  return new Date(createdTime + slaMinutes * ONE_MINUTE).toISOString();
}

export function getTicketExpiresAt(ticket) {
  if (ticket?.expiresAt && !Number.isNaN(new Date(ticket.expiresAt).getTime())) {
    return ticket.expiresAt;
  }

  return calculateTicketExpiresAt(ticket?.createdAt, ticket?.priority || PRIORITIES.P4);
}

export function isTicketClosed(ticket) {
  return ticket?.status === STATUS.CLOSED;
}

export function getTicketRemainingMs(ticket, now = Date.now()) {
  const expiresAt = getTicketExpiresAt(ticket);
  if (!expiresAt) return null;
  return new Date(expiresAt).getTime() - now;
}

export function isTicketOverdue(ticket, now = Date.now()) {
  const remainingMs = getTicketRemainingMs(ticket, now);
  return !isTicketClosed(ticket) && remainingMs !== null && remainingMs <= 0;
}

export function formatTicketRemaining(ticket, now = Date.now()) {
  if (isTicketClosed(ticket)) return '已关闭';

  const remainingMs = getTicketRemainingMs(ticket, now);
  if (remainingMs === null) return '-';

  if (remainingMs <= 0) {
    return `已超时 ${formatDuration(Math.abs(remainingMs), true)}`;
  }

  if (remainingMs < ONE_MINUTE) {
    return `${Math.max(1, Math.ceil(remainingMs / ONE_SECOND))}秒`;
  }

  return formatDuration(remainingMs, false);
}

export function shouldUseSecondRefresh(tickets, now = Date.now()) {
  return tickets.some((ticket) => {
    if (isTicketClosed(ticket)) return false;
    const remainingMs = getTicketRemainingMs(ticket, now);
    return remainingMs !== null && remainingMs > 0 && remainingMs < ONE_MINUTE;
  });
}

export function sortTicketsByPriorityAndCreatedAt(tickets = []) {
  return [...tickets].sort((left, right) => {
    const priorityDelta = getPriorityOrder(left.priority) - getPriorityOrder(right.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function getPriorityOrder(priority) {
  return PRIORITY_ORDER[priority] || PRIORITY_ORDER[PRIORITIES.P4];
}

function formatDuration(durationMs, includeSecondsWhenUnderMinute) {
  if (durationMs < ONE_MINUTE) {
    return includeSecondsWhenUnderMinute
      ? `${Math.max(1, Math.ceil(durationMs / ONE_SECOND))}秒`
      : '1分钟';
  }

  const totalMinutes = Math.ceil(durationMs / ONE_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes}分钟`;
  if (!minutes) return `${hours}小时`;
  return `${hours}小时${minutes}分钟`;
}
